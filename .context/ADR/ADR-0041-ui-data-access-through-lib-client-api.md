# ADR-0041 — The UI reaches data through plain `lib/` functions; `components/` owns hooks, never a Supabase client

- **Status:** Accepted <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-06
- **Deciders:** Basi Montes
- **Tags:** architecture, layering, data-access, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Audit-6 (A6-A7, A6-A13) found the layer boundary of `AGENTS.md` section 10 only half kept. FRESCO-788 added an ESLint lock: `components/**` may not import `@/lib/supabase/*` or `@supabase/*`. It shipped with an allowlist (`COMPONENTS_WITH_DIRECT_SUPABASE_ACCESS`) of 27 files that already broke the rule, "left alone until FRESCO-810 moves their calls". The list only shrinks.

Measured on 2026-10-06 (FRESCO-810):

- 26 of those 27 files still import Supabase (the 27th was a stale entry). 24 of them do the same thing: `createClient()` and pass the client into a `lib/api/*` function. Only one (`identity-cookie-sync.tsx`) queries a table by hand.
- Three route handlers hold inline queries and domain logic: the Stripe webhook (8 `.from()`), the reconcile cron (4) and the profile export (4).
- `lib/` holds nine React hooks (`lib/onboarding/use-*.ts`, `lib/signup/use-*.ts`, `lib/shopping-list/use-shopping-list.ts`, `lib/auth/use-captcha.ts`), against the "framework-agnostic" rule for `lib/`. Five of them were created by FRESCO-809, four of them (`lib/signup/*`, `use-shopping-list`) precisely because a hook in `components/` could not import Supabase.
- `lib/fixtures/page-shells.tsx` imports 13 components: `lib/` depending on `components/`, the inverse of the layering.

So the two rules collide: a hook belongs in `components/`, but a hook needs a client, and `components/` may not import one. Whatever resolves this is cross-cutting and touches dozens of files, so it needs one recorded answer.

## Decision

We will keep **data access in `lib/`** and **React in `components/`**, joined by plain async functions.

1. **`components/**` and the UI parts of `app/**` never import a Supabase client or the SDK.** This is the existing lint lock; the allowlist is emptied and the constant deleted, so the lock has no exceptions.
2. **Browser-side data calls go through `lib/client-api/<domain>.ts`**: plain `async` functions that create the browser client themselves and delegate to the injectable `lib/api/*` functions. A component calls `updateMyNombre(nombre)`, never `updateNombre(createClient(), nombre)`. `lib/api/*` keeps taking a `client` argument (server, browser and tests).
3. **React hooks live in `components/<area>/use-*.ts`.** `lib/` contains no hook and no JSX. `React.cache` on server reads stays allowed in `lib/api/*`.
4. **Route handlers orchestrate; they do not query.** Parsing, authorization and the response stay in the route; table access moves to `lib/billing/*` and `lib/api/*`, named for what the domain does (`getBillingState`, `syncIdentity`), not for the table.
5. **Fixtures that render components live outside `lib/`** (`components/__fixtures__/` or `tests/`).

The invariant a future change must not break: **no file under `components/` imports `@/lib/supabase/*` or `@supabase/*`, and no file under `lib/` imports a React hook or a component.**

## Consequences

- **Positive:** the lint lock has no exceptions, so the boundary stops depending on a shrinking list nobody owns. Components become testable with a plain mocked `lib/client-api` module instead of a faked Supabase client. `lib/` becomes importable from a route, an Edge Function test or a script without pulling React.
- **Negative / trade-offs:** one more layer (`lib/client-api`) to write and keep in step with `lib/api`; each wrapper is a few lines, but there are ~24 of them. Hooks that today sit next to their logic split into a hook (components) and a function (lib). Component tests that fake a client must be rewritten to mock the wrapper. `lib/api/*` functions keep their `client` parameter, so the browser wrappers are the only place that calls `createClient()`.
- **Neutral / follow-ups:** a lint rule forbidding React hooks in `lib/` can only catch named imports, not `React.useState` through a namespace import, so a small test greps for it. FRESCO-809's five hooks move back out of `lib/` as part of this work.

## Alternatives considered

- **A single `SupabaseProvider` component that is the only importer, with `useSupabase()` in every other component.** Cheapest (mechanical, and good for tests) and it turns the lint green, but the components still hold and pass a client: the data access stays in the UI layer and the metric is met by moving the import, not the responsibility. The definition of done warns against closing "by the mechanism". Rejected.
- **Keep the allowlist and only stop it growing.** Zero cost, but the audit finding stays open and 26 files remain outside the rule indefinitely. Rejected.
- **Keep the hooks in `lib/`.** Works today, but contradicts the "framework-agnostic `lib/`" convention and makes `lib/` depend on React; it was a workaround for the very collision this ADR resolves. Rejected.

## References

- FRESCO-810 (this decision), FRESCO-788 (the lint lock), FRESCO-809 (the hooks created in `lib/`).
- Audit-6, architecture axis: `.context/audits/2026-10-02-audit-6/architecture.md` (A6-A7, A6-A13).
- `AGENTS.md` section 10 (Layers, Utilities); ADR-0024 (component test infrastructure).
