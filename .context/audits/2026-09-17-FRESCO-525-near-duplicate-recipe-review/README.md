# FRESCO-525 — Near-duplicate recipe name review (11 groups)

**Jira:** [FRESCO-525](https://basiliomontescastano.atlassian.net/browse/FRESCO-525) (Tarea)
**Spun off from:** [FRESCO-522](https://basiliomontescastano.atlassian.net/browse/FRESCO-522) — analysis-only ticket that first quantified these 11 groups.
**Scope:** analysis + a ready-to-run (never executed) merge script. No production data was mutated by this ticket. All `--apply` runs require explicit human sign-off, per the ticket's own "no automatizable a ciegas" framing.

## Method

1. Reproduced FRESCO-522's normalization method in SQL directly against `recipes` (linked prod project via `supabase db query --linked`, per project convention — Supabase MCP was down for this session): lowercase, strip accents (`á é í ó ú ñ`), strip the connector words `de con a al y en la el los las` as whole tokens, collapse whitespace. Grouped by the normalized string, filtered to groups where the **literal** `nombre` values differ (excludes the 47 exact-name-duplicate groups already covered by FRESCO-522/FRESCO-460 — different ticket, different scope).
2. This reproduced **exactly the same 11 groups** named in the ticket description, confirming no near-duplicate group was missed or added since FRESCO-522's 2026-09-15 snapshot.
3. For each group, fetched `id`, `nombre`, `ingredientes_principales` for every row and compared arrays. Any two rows are called **IDENTICAL** only when they contain the same ingredient values (order-insensitive; array-order-only differences are called out explicitly, not silently treated as a clean match).
4. For groups recommended to merge, looked up live reference counts in `favorites` and `meal_plan_recipes` (the only two tables with a FK to `recipes.id`, confirmed via `information_schema`) for both the canonical and the to-be-deactivated id, to size the actual redirect blast radius today.

## Canonical-recipe selection rule (for MERGE groups)

To stay consistent with the existing repo convention (`scripts/prune-duplicate-recipes.ts`, FRESCO-460), the survivor within a merge pair is chosen by: **has `foto_url`** > **higher `veces_cocinada + veces_calificada` signal** > **oldest `created_at`**. This is a deliberate, documented choice — not always the "more grammatically complete" name. Where it produces a survivor whose name looks worse than the row being deactivated (missing a connector word), it's flagged below as a follow-up candidate for a *separate*, explicit cosmetic-rename decision — never auto-applied here, because picking new descriptive text is a content decision, not a deterministic text fix (unlike FRESCO-524/526's regex-based template fixes).

## Reference tables scoped for redirect

Only two tables carry a foreign key to `recipes.id` (verified via `information_schema.table_constraints` / `key_column_usage` / `constraint_column_usage`):

| Table | FK column | Constraint |
|---|---|---|
| `favorites` | `recipe_id` | `favorites_recipe_id_fkey` — plus `UNIQUE(user_id, recipe_id)` |
| `meal_plan_recipes` | `recipe_id` | `meal_plan_recipes_recipe_id_fkey` (nullable column) |

`meal_plan_recipes.recipe_id` is `ON DELETE RESTRICT` (see `supabase/migrations/20260908180000_recipes_activo_soft_delete.sql`) — this is exactly why merges never hard-delete, only `activo = false` plus a reference redirect. `favorites` has a `(user_id, recipe_id)` uniqueness constraint, so a straight `UPDATE ... SET recipe_id = <canonical>` can violate it if the same user already favorited both recipes in a pair — the merge script handles that case by deleting the now-redundant `favorites` row instead of updating it into a conflict (see script comments).

## Verdict summary (11 groups)

| # | Group | Rows compared (id · nombre) | `ingredientes_principales` | Verdict |
|---|---|---|---|---|
| 1 | Crema de calabacín (accent) | `154f8b38` Crema de calabacin (no accent) · `c7a29db6` / `4861222e` Crema de calabacín (accent, ×2) | No-accent = `[calabacín, puerro, queso fresco]`; accented rows = `[calabacín, cebolla, patata]` (+ one has extra `caldo de verduras`) | **KEEP** — all genuinely distinct. See flag below. |
| 2 | Batido verde + frutos rojos | `71bd98eb` con · `92598a37` (bare) | Both `[espinacas, plátano, leche]` | **MERGE** |
| 3 | Batido verde + miel | `a8edf55f` con · `f87aa7ce` (bare) | Both `[espinacas, plátano, leche]` | **MERGE** |
| 4 | Crema de puerros + patata | `5d835d33` con · `b91d4a0f` y | con=`[puerro, patata, nata]`; y=`[puerro, patata, aceite de oliva]` | **KEEP** |
| 5 | Curry de garbanzos + espinacas | `fc8662d7` con · `4942047f` y | con=`[garbanzos, espinacas, leche de coco]`; y=`[garbanzos cocidos, espinacas, cebolla, ajo]` | **KEEP** (matches FRESCO-522's own prior finding) |
| 6 | Ensalada de burrata + tomate | `55b3a6ae` con · `fc9b80ef` y | con=`[burrata, tomate, albahaca]`; y=`[tomate, queso mozzarella, albahaca]` | **KEEP**. Flag below. |
| 7 | Revuelto de gambas + ajetes | `a071324d` con · `017bf4b6` y | con=`[gambas, huevo, ajetes]`; y=`[huevo, gambas, ajo]` | **KEEP** (ajetes ≠ ajo) |
| 8 | Sándwich de pavo + queso | `ecd9d775` con · `5f8c3403` y | con=`[pavo, queso, tomate]`; y=`[pan, pechuga de pavo, queso]` | **KEEP** |
| 9 | Sopa de calabacín + menta | `a0af9eb2` con · `44c43290` y | con=`[calabacín, menta, cebolla]`; y=`[calabacín, menta, aceite de oliva]` | **KEEP** |
| 10 | Batido verde + canela | `d67259a9` con · `d806c307` (bare) | Both `[espinacas, plátano, leche]` | **MERGE** |
| 11 | Sopa de tomate + albahaca | `ca33bf14` con · `1b85af10` y | con=`[tomate, albahaca, cebolla]`; y=`[tomate, cebolla, albahaca]` — **same set, different array order** | **MERGE**. Flag below (order-only difference, not byte-identical). |

**4 MERGE / 7 KEEP.**

## Merge plan detail

| Group | Canonical (survives) | Deactivated (this run) | Live refs to redirect today |
|---|---|---|---|
| Batido verde + frutos rojos | `71bd98eb-8f99-4cb9-996e-622471e0e694` "Batido verde con frutos rojos" (has photo) | `92598a37-b83f-4c22-921a-2d71c797125d` "Batido verde frutos rojos" (no photo) | 0 in `favorites`, 0 in `meal_plan_recipes` |
| Batido verde + miel | `f87aa7ce-aa3e-45ff-b6a9-f152404e61a0` "Batido verde miel" (both have photos, tied signal, this one is older) | `a8edf55f-21da-4269-a3d6-a248d6d4e50c` "Batido verde con miel" | 0 in `favorites`, **1** in `meal_plan_recipes` |
| Batido verde + canela | `d67259a9-89a5-4aaa-95dc-a5e3f68806a8` "Batido verde con canela" (has photo) | `d806c307-1c2f-4c4a-b30c-cf15ce75c256` "Batido verde canela" (no photo) | 0 in `favorites`, 0 in `meal_plan_recipes` |
| Sopa de tomate + albahaca | `1b85af10-6641-4cf8-b68a-425a37575391` "Sopa de tomate y albahaca" (higher usage signal: `veces_cocinada=2`) | `ca33bf14-c5c9-4d20-90fd-5ab141d0515b` "Sopa de tomate con albahaca" (`veces_cocinada=0`) | 0 in `favorites`, 0 in `meal_plan_recipes` |

Only the "Batido verde + miel" merge has a live redirect to perform (1 row in `meal_plan_recipes`). The other three currently have zero live references — but the script recomputes reference counts live at run time rather than trusting this document, since (per `prune-duplicate-recipes.ts`'s own stated rationale) catalog and usage data can change between planning and execution.

## Cosmetic renames

**None applied.** Considered and rejected for all 7 KEEP groups: disambiguating them meaningfully (e.g. naming the actual differentiating ingredient) is a content-authorship decision, not a deterministic text fix like FRESCO-524/526's connector/template cleanup — picking the wrong descriptor would be worse than the current mild visual collision. Left as a recommendation for a human/product decision, not auto-applied.

## Flags — needs human review before any `--apply`

0. **BLOCKER (found running the script's dry-run, not part of the original analysis): `service_role` cannot read `favorites` or `meal_plan_recipes` via PostgREST today.** Live `curl` against both tables with `SUPABASE_SERVICE_ROLE_KEY` returns `403 42501 permission denied`, with Postgres's own hint: `GRANT SELECT ON public.<table> TO service_role`. `recipes` itself has the grant and reads fine — this looks like an oversight on these two tables specifically, not an intentional restriction. **Practical effect: `scripts/merge-near-duplicate-recipes.ts --apply` cannot run at all right now** — it would refuse to deactivate any duplicate rather than redirect blind, since deactivating without confirming the redirect worked would orphan any live reference. This needs a migration (`GRANT SELECT ON public.favorites, public.meal_plan_recipes TO service_role;`, mirroring whatever grant `recipes` already has) before this ticket's `--apply` step — or any future script that touches these two tables via the service-role REST path — can run. Not fixed here: out of this ticket's scope (a schema/grants change), and grant changes deserve their own review. The reference counts quoted in the "Merge plan detail" table above are still accurate — those came from `supabase db query --linked` (a direct Postgres connection that bypasses PostgREST role grants entirely), not from the REST path the script uses.
1. **Batido verde + miel canonical is the weaker-looking name.** The tiebreak (photo/signal/age) picks `f87aa7ce` "Batido verde miel" (no connector) as the survivor over `a8edf55f` "Batido verde con miel". If display-name quality should override the usage-signal tiebreak here, either pick `a8edf55f` as canonical instead, or merge as planned and then apply a **separate**, explicit cosmetic rename of the survivor to "Batido verde con miel" afterward.
2. **Sopa de tomate + albahaca ingredients are the same set but a different array order** (`[tomate, albahaca, cebolla]` vs `[tomate, cebolla, albahaca]`), not byte-for-byte identical. Treated as MERGE here (same content, order carries no known semantic meaning in this schema), but flagging since "idénticos" in the ticket could be read strictly as exact array equality.
3. **Crema de calabacín group has a nested, out-of-scope issue.** The two *accented* rows (`c7a29db6` and `4861222e`) share the exact same `nombre` ("Crema de calabacín") but have different `ingredientes_principales` (one has an extra `caldo de verduras`) — this is an **exact-name duplicate with different content**, which is FRESCO-522/FRESCO-460 territory (not a near-duplicate-name case), and wasn't pruned by the FRESCO-460 run because `prune-duplicate-recipes.ts` clusters by `ingredientes_principales` too, so these two rows never landed in the same cluster. Surfacing here since it was found while reviewing this group; no action taken on it in this ticket.
4. **"Ensalada de burrata y tomate" doesn't actually list burrata as an ingredient** (`[tomate, queso mozzarella, albahaca]`) despite the name. Possibly a generator/labeling bug independent of the near-duplicate question — recommend a follow-up ticket, not acted on here.
5. **Canonical-selection rule choice itself is a judgment call.** This doc follows the existing `prune-duplicate-recipes.ts` convention (photo > signal > age) for consistency. A reviewer could reasonably prefer a different rule (e.g. always prefer the name with the connector word present). The merge script's canonical-id assignments would need to change if a different rule is chosen — they are hardcoded per pair, not recomputed by an algorithm, specifically so a human can override any single one without re-deriving the whole batch.

## SQL used

See `queries.sql` in this folder for the exact normalization + comparison queries run against the linked prod Supabase project (read-only, `supabase db query --linked`).
