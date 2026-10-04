# ADR-0040 — Consent registry: an append-only `user_consents` table, written under the user's own RLS

- **Status:** Proposed <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-04
- **Deciders:** Basi Montes
- **Tags:** privacy, gdpr, rls, consent, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Audit-6 (A6-P1, A6-P6) found that nothing records a user's consent. The Terms checkbox on `/signup` is client state and disappears on submit; the second sign-up path (onboarding, including guest mode) asks for nothing; allergies are collected without explicit consent, although they are health data (GDPR art. 9.2.a); and there is no record of which version of which text a user accepted. GDPR art. 7.1 makes the controller demonstrate consent, so "the user ticked a box once" is not evidence.

The lawyer draft (`.context/legal/FRESCO-365-borrador-textos-legales.md`) and the brief (§5) ask for the registry (item 13). The founder decided on 2026-10-04 to build the mechanism now, with the draft texts marked provisional.

## Decision

We will record consents in **one append-only table, `public.user_consents`**: `user_id`, `kind` (`age_14`, `terms`, `privacy`, `health_data`, `withdrawal_waiver`), `version`, `accepted_at`, unique on `(user_id, kind, version)`.

- **Written under the user's own session, not with the service role.** RLS lets an authenticated user (a guest included) read and insert only their own rows. There is no UPDATE and no DELETE policy, so a row cannot be rewritten or withdrawn from the client.
- **The INSERT grant is column-level, `(kind, version)`.** `user_id` defaults to `auth.uid()` and `accepted_at` to `now()`, so the caller can neither name another owner nor backdate a consent. This is proved against a real database in `tests/db/user-consents.test.ts`.
- **The version is the server's.** `POST /api/consents` stamps `LEGAL_TEXTS_VERSION` (`lib/legal/consent.ts`) and ignores any version in the body.
- **The foreign key points at `auth.users`, not `user_profiles`.** A guest is an anonymous auth user and may consent before any profile row exists; the rows keep their `user_id` when the guest converts to an account.
- **Texts live in code, versioned.** When a lawyer changes a sentence, the constant changes and `LEGAL_TEXTS_VERSION` is bumped; a new version is what lets a later flow ask for consent again.

## Alternatives considered

- **Columns on `user_profiles`** (`accepted_terms_at`, `accepted_terms_version`, …): rejected. It keeps only the latest value per kind, so the history of what was accepted when is lost, and a guest has no profile row yet.
- **Write through the service role from the API route**, so the user cannot touch even their own evidence: rejected for now. `lib/supabase/service.ts` documents two callers, both subscription-state writers, and every other server write goes through the RLS-scoped client; a third caller would be a new exception for a marginal gain, because the only thing a user could forge is the record of their own consent.
- **A `SECURITY DEFINER` RPC that reads the current version from a table**, so the database assigns it: rejected as over-built. It needs a second source of truth for the version, kept in sync with the code, to defend against the same self-inflicted case.

## Consequences

- **Positive:** consent has a durable, queryable record with version and time; the history survives a text change; a guest's consent follows them into their account; no new privileged client.
- **Negative / trade-offs:** a user who bypasses the API route can write a wrong `version` string for their OWN consent. It is self-inflicted and not a way to obtain anything, but it means the registry is the user's record, not tamper-proof evidence against that same user. If legal advice requires stronger evidence, move the write to the service role or a `DEFINER` RPC and revoke the INSERT grant; the table shape does not change.
- **Neutral / follow-ups:**
  - The texts are PROVISIONAL, taken from the lawyer draft and not validated by a lawyer. FRESCO-794 stays open until the lawyer's report is attached or the founder defers it in writing.
  - `service_role` has read-only access, for audits and the data export. The export (`GET /api/profile/export`) should include a user's consents; not done here.
  - Withdrawing a consent (the right to withdraw as easily as it was given) needs its own decision: this table is append-only, so a withdrawal would be a new kind or a new table, not a delete.
  - **Go-live prerequisite, VAT.** The pre-contract summary before Stripe Checkout (`components/profile/pro-checkout-summary.tsx`) reads the price from Stripe (`GET /api/stripe/pro-price`) and says "IVA incluido" only when the Price declares `tax_behavior: 'inclusive'`. On 2026-10-04 the test-mode Pro Price (4,99 € / month) has `tax_behavior: 'unspecified'`, so the summary makes no tax claim. The lawyer draft leaves the VAT treatment open (clause 6.2); before charging real users the live Price must be set to `inclusive` (or the VAT handling decided) so the summary can state the total price with taxes (arts. 20.1 and 60.2.c TRLGDCU).
  - The checkbox for the immediate-execution request (`withdrawal_waiver`, art. 103.m) is recorded before the redirect to Stripe; if it cannot be recorded, no checkout is created. Its scope for a monthly subscription is an open decision in the draft (clause 7.4).

## References

- `supabase/migrations/20261004120000_user_consents.sql`, `lib/legal/consent.ts`, `app/api/consents/route.ts`, `tests/db/user-consents.test.ts`
- `.context/legal/FRESCO-434-brief-abogado.md` §5, `.context/legal/FRESCO-365-borrador-textos-legales.md`
- `.context/audits/2026-10-02-audit-6/product.md` (A6-P1, A6-P6); FRESCO-794; ADR-0032 (no identity parameter), ADR-0025 (cookie consent gate)
