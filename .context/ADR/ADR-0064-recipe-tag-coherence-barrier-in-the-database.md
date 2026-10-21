# ADR-0064 — An active recipe cannot be saved with allergen or diet tags that contradict its text

- **Status:** Accepted <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-21
- **Deciders:** Basi Montes (mechanism and scope agreed in conversation on 2026-10-21, FRESCO-1020; accepted in writing on 2026-10-22 after reading the summary); drafted by an AI session
- **Tags:** catalogue, food-safety, database, integrity
- **Supersedes:** —
- **Superseded by:** —

---

## Context

The allergen filter (`get_filtered_recipes`) is a plain comparison of tags: a recipe whose `alergenos` lacks `lactosa` is served to someone who declared a dairy allergy even if its ingredient list says "queso". The rules that say whether a recipe's tags contradict its own text (`alergenos`, and the ten `dieta` flags) lived only in TypeScript, in `tests/db/recipe-allergen-diet-rules.ts`. They ran in CI over `seed.sql` and in a nightly audit of the hosted catalogue. A recipe written straight to the hosted database, or one reactivated, therefore reached users with wrong tags until the next night. FRESCO-997 and FRESCO-998 left the catalogue clean but with nothing to keep it clean.

## Decision

1. **The rules live in one SQL function**, `recipe_tag_findings(alergenos, dieta, ingredientes_principales, pasos_resumen)`, the twin of the TypeScript oracle. It returns one row per broken rule, keyed like the oracle (`falta:gluten`, `dieta:keto`). `tests/db/recipe-tag-findings-parity.test.ts` keeps the two equal: one probe per word of every keyword list, as ingredient and as step, plus every recipe of the catalogue.
2. **A trigger calls it**: `recipes_tag_coherence`, `BEFORE INSERT OR UPDATE OF alergenos, dieta, ingredientes_principales, pasos_resumen, activo` on `public.recipes`. It rejects with SQLSTATE 23514 (`check_violation`) and a message that names the recipe and lists each broken rule.
3. **It only guards active rows.** An inactive recipe is a draft and saves freely; the barrier acts when a recipe is published: inserted active, edited while active, or reactivated.

The invariant: **a recipe the app can serve always has tags that agree with its text, whoever wrote the row and through whichever path.**

## Alternatives considered

- **A `CHECK` constraint with an immutable function.** Rejected. PostgreSQL evaluates every CHECK on every UPDATE of the row, whichever column changed, and `recipes` is updated often (learning counters, photos, the last-in-menu date). The rules would run, and could block, writes that never touch the tags. A trigger with `UPDATE OF` fires only when a column the rules read is written.
- **A trigger on every UPDATE.** Rejected for the same reason, and it would turn a counter bump on a recipe that is already wrong into a failure unrelated to the write.
- **Guard inactive rows too.** Rejected: a half-written draft is exactly what an inactive row is for. The barrier stands between a recipe and the user, not between a recipe and the editor.
- **Keep only the nightly audit.** Rejected: it detects after the fact, so a wrong recipe is served for up to a day.
- **One source of truth in SQL only, drop the TypeScript oracle.** Rejected: the oracle also drives the CI seed audit, the hosted audit script and `generate-meal-plan` tests, and a parity test is cheaper than moving all of them.

## Consequences

- **Positive:** a wrong tag cannot reach production through a direct insert, an edit or a reactivation; the error says which rule and why; the nightly audit becomes a second line, not the only one.
- **Negative / trade-offs:**
  - Two copies of the rule table exist. Adding or changing a keyword means editing the SQL function and the TypeScript oracle in the same change; the parity test fails if they drift. That is the price of not rewriting every consumer of the oracle.
  - An edit that is legitimate but looks wrong to the rules is rejected. The fix is to correct the data or the text, or, if the rule is wrong, to change it in both places with an exception and its reason.
  - Seven inactive recipes in the hosted catalogue have findings today (six "Wrap de pollo" rows missing `gluten` and one burrata salad missing `lactosa`). They stay saveable but cannot be reactivated until fixed.
  - A migration that rewrites tags of an ACTIVE recipe after this one runs through the barrier too; it must leave the recipe coherent.
- **Neutral / follow-ups:** the barrier checks the tags against the text; it does not decide whether a keyword list is complete (that is the human review of FRESCO-908). The helper functions are not an API: execute is revoked from `public`, `anon` and `authenticated`.
