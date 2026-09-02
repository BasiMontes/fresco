# ADR-0004 — Guest-data reassignment on email conflict: password-verified, service-role-only RPC

- **Status:** Accepted — verification step revised by ADR-0022 (2026-09-02)
- **Date:** 2026-07-31
- **Deciders:** Founder (product + technical decision, drafted by AI workflow for approval)
- **Tags:** authentication, data-model, cross-cutting-invariant, guest-mode, service-role, master-sprint-2-unblock
- **Supersedes:** —
- **Superseded by:** ADR-0022 (ownership-verification step only — the service-role RPC, its grant boundary, and the orphan-anon cleanup all still stand)

---

## Context

ADR-0003 resolved Guest Mode's auth mechanism (Supabase Anonymous Sign-In) but explicitly named one unresolved branch: "if the email already belongs to an existing different account, `updateUser` errors and the app must fall back to a sign-in + manual `user_id` reassignment flow... FRESCO-7's [now FRESCO-19's] story must plan for this branch explicitly, not treat the happy path as the only path." FRESCO-19 shipped the detection (`email_exists` error code) and a non-silent message pointing the guest at `/login`, but deliberately deferred the actual data move — tracked as FRESCO-20 (this decision).

The problem: a guest's generated data (`meal_plans`, `meal_plan_recipes`, `shopping_lists`) is owned by her anonymous session's `user_id` (== her anonymous `auth.users.id`, per `user_profiles.id` being the same value). When the email she wants to register with already belongs to a *different*, real account, there is no Supabase Auth primitive to "merge" two users — the guest's data has to be moved to the real account's `user_id` by application code. This is genuinely privileged: it means one authenticated context (the calling code) writing rows it does not itself own via the normal `auth.uid()`-scoped RLS policies (`meal_plans_update_own` et al. all check `user_id = auth.uid()`, which by definition cannot match a *different* target user).

This is the first place this codebase needs a privileged, cross-user-boundary write. Every prior privileged function (`swap_meal_plan_slots` — ADR-0002; `jsonb_set_comprado`) is `security definer` but still scoped to a single caller's own data (verified via `auth.uid()` inside the function). A function that moves data *between* two different real users' rows is a different, higher-risk class of operation: if it is directly callable by an ordinary authenticated client with an arbitrary `(from_user_id, to_user_id)` pair, any user could reassign *any other real user's* data to themselves — not just an abandoned guest session's. This is exactly the kind of decision that is both architectural (introduces the project's first service-role-privileged code path and its first Edge Function using the Auth Admin API) and hard to reverse (a wrong design here either blocks the conversion flow entirely, or — far worse — opens a real cross-account data-theft vector; retrofitting a security boundary after a vulnerable version has run in production is not a safe do-over).

## Decision

**Guest-data reassignment happens through a new `reassign-guest-data` Edge Function that (1) independently verifies the target account's real password before doing anything, and (2) is the *only* caller of a new `reassign_guest_data(p_from_user_id, p_to_user_id)` SQL function whose `EXECUTE` privilege is revoked from every ordinary Postgres role and granted only to `service_role`.**

Concretely:

1. **`reassign-guest-data` Edge Function** (new, 4th function in this project): called with the guest's still-active anonymous session (`Authorization: Bearer <anon_access_token>`) plus `{ email, password }` for the target account.
   - Verifies the caller is actually an anonymous session (`user.is_anonymous === true`) — refuses otherwise.
   - Verifies the target account's password by calling `signInWithPassword({ email, password })` against a **fresh, unauthenticated client** (anon key, no service role) — this is the ownership proof: the caller can only claim an account whose real password they know, the same bar as a normal login. A failure here returns a generic 401 (never confirms/denies whether the email itself exists, to avoid an enumeration side-channel).
   - On success, calls `reassign_guest_data(anon_user.id, target_user.id)` using a **service-role client** (the only client in this codebase with the privilege to call that function).
   - Then calls `supabase.auth.admin.deleteUser(anon_user.id)` (service-role, Admin API) to remove the now-empty anonymous identity — the concrete cleanup ADR-0003 flagged as a known gap ("no automatic cleanup... a future scheduled cleanup... is a real operational task this ADR surfaces but does not solve"), scoped here to exactly the one path where the anonymous user's lifecycle definitively ends.
2. **`reassign_guest_data(p_from_user_id uuid, p_to_user_id uuid)`** (new SQL function, `security definer`):
   - Reassigns `meal_plans` from `p_from_user_id` to `p_to_user_id`, **skipping** any plan whose `semana_iso` the target account already has a plan for (`unique_user_semana` constraint) — the target's own, pre-existing data for that week wins; the guest's conflicting plan is not force-merged.
   - Mirrors the same reassignment onto `shopping_lists` (own `user_id` column, not derived from `meal_plans.user_id` at read time) for whichever plans actually moved.
   - Deletes the now-orphaned `user_profiles` row for `p_from_user_id` — any guest data left behind (the conflicting week, if any) cascades away with it (`on delete cascade` FKs already in place). The target account's own profile (diet, allergens, etc.) is never touched or overwritten — it remains the single source of truth for that real user, which matters for the food-safety guardrail (FR-8.1).
   - `EXECUTE` is revoked from `public`, `anon`, `authenticated` and granted only to `service_role` — this is the actual security boundary. An ordinary authenticated user has no path to invoke this function directly with an arbitrary pair of ids; only the Edge Function above can call it, and only after it has independently verified the target account's password.
3. **`/signup`** (frontend): on the `email_exists` conflict, instead of only linking to `/login`, prompts for the target account's password inline and calls `reassign-guest-data`; on success, signs in normally (`signInWithPassword`) and redirects to `/menu` — she now sees her real account, with the guest week merged in unless it collided with an existing one.

## Consequences

- **Positive:** closes the last named gap from ADR-0003's "not treat the happy path as only path" — a guest who happens to already have an account is no longer stuck at a dead-end message. Establishes a reusable, reviewed pattern (password-verify-then-service-role-RPC) for any *future* cross-user data operation this app might need, rather than each one inventing its own ad hoc privilege escalation.
- **Negative / trade-offs:** this is the first code in the repo that holds and uses `SUPABASE_SERVICE_ROLE_KEY` inside an Edge Function — a genuinely more powerful credential than every other function's RLS-scoped anon-key client. Any future change to `reassign-guest-data` must be reviewed with that in mind; a bug here has a materially larger blast radius (real cross-user data movement, real account deletion) than a bug in an RLS-scoped function. The conflicting-week case silently drops the guest's plan for that specific week (favoring the existing account's data) — this is a deliberate, but real, data-loss trade-off for that one edge case, not flagged to the user beyond the existing "ya existe una cuenta" message.
- **Neutral / follow-ups:** `reassign_guest_data` only touches `meal_plans`/`meal_plan_recipes` (via cascade)/`shopping_lists` — if a future story adds new user-owned tables, this function's reassignment list must be extended explicitly; it will not pick up new tables automatically.

## Alternatives considered

- **Client-driven reassignment (client reads its own anonymous data, re-inserts it under the new session after login).** Rejected: requires the client to hold both sessions' tokens simultaneously and re-implement the reassignment logic per table in TypeScript instead of one atomic SQL statement; also means the client, not the server, decides what counts as "the same data," a worse trust boundary than a single audited SQL function.
- **A single RPC directly callable by the authenticated client, with the target user id supplied by the client and "verified" only by checking the caller is anonymous.** Rejected outright — this is the exact vulnerability this ADR exists to prevent: nothing would stop an anonymous session from passing an arbitrary *real* user's id and stealing their data. Password verification must happen before the privileged call, not be assumed from context.
- **Merge the guest's `user_profiles` answers into the target account (instead of discarding them).** Rejected: the target account already has its own onboarding answers, including declared allergens — silently overwriting or merging those is a food-safety risk (FR-8.1) for a marginal, unrequested convenience. The guest's profile row is discarded, not merged.
- **Do nothing (leave FRESCO-20 as a permanent dead-end message).** Rejected per the user's own explicit choice to prioritize a real fix over shipping a permanent gap, once the design was reviewed and approved.

## References

- `.context/ADR/ADR-0003-guest-auth-anonymous-sign-in.md` — names this exact gap as a known open risk.
- `.context/ADR/ADR-0002-position-swaps-bypass-learning-trigger.md` — the prior precedent for a `security definer` function scoped to a single caller's own data; this ADR's function is the first that crosses that boundary between two different real users.
- `supabase/migrations/20260725120100_create_fresco_core_tables.sql` — `unique_user_semana`, `unique_plan_lista` constraints; FK cascade shape for `meal_plans`/`shopping_lists`/`meal_plan_recipes`.
- FRESCO-19 (`Registro Progresivo | Solicitar registro tras ver el menú generado`) — where the `email_exists` detection + non-silent message already ships; FRESCO-20 is this decision's implementation ticket.
