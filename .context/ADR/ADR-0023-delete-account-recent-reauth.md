# ADR-0023 — `delete-account`: require a recent re-authentication, verified as a token

- **Status:** Proposed <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-09-02
- **Deciders:** Founder (approval pending); drafted by AI workflow (FRESCO-397, audit-4 ola-3, eje Arquitectura)
- **Tags:** authentication, security, edge-function, api-contract, account-lifecycle
- **Supersedes:** —
- **Superseded by:** —

---

## Context

`delete-account` (FRESCO-70) permanently deletes the caller's own account and, by FK cascade, every row she owns. As shipped, its only precondition was a valid `Authorization` JWT: `requireAuthenticatedUser` resolves the caller, and that same id is deleted. The "are you sure" gate — typing your exact email — lived **entirely in the client dialog**; the Edge Function accepted an empty body and never re-checked intent.

Audit-4 (finding A4-L11, severity BAJO) flagged the consequence: a leaked or stolen access token (XSS, a token logged somewhere, a shared device) is enough to destroy an account with one direct API call, no friction, and there is no rate limit to slow a scripted attempt. Every other privileged path in the tree had already been hardened — `reassign-guest-data` (ADR-0022), `update-recipe-status` (FRESCO-362) — `delete-account` was the straggler.

ADR-0022 set the pattern for "prove you are who you say, right now" in this codebase: **do not verify a password server-side** (that turns the function into a brute-force oracle sitting outside Supabase Auth's own protections); instead have the client re-authenticate through native Auth and pass the resulting session token, which the function only verifies.

## Decision

**A registered caller of `delete-account` must pass `reauthToken` — a Supabase access token minted by an immediately-preceding `signInWithPassword` — which the Edge Function verifies for authenticity, ownership, and recency. Plus a per-user rate limit. A guest (anonymous) caller has no password and is gated by the rate limit alone.**

Concretely:

1. **Request contract** gains `DeleteAccountRequest { reauthToken?: string }`. The `Authorization` header still carries the caller's session (identity, unchanged).
2. **Rate limit** — the function calls `enforceRateLimit` (ADR-0010, `_shared/rate-limit.ts`) keyed on the caller's user id, endpoint `delete-account`, 5/hour, fail-closed. It runs *before* the re-auth check, so that check cannot be hammered either.
3. **Recent re-auth** (registered callers only, `!user.is_anonymous`):
   - `reauthToken` is required; absent → generic `401`.
   - Its `iat` must be within **5 minutes** of now (with 60s future skew tolerance). This is a signature-free payload read (`reauth.ts` `isTokenRecent`) — cheap, and rejects a stale/replayed token before any network call.
   - It must be authentic and belong to the same user: `createRequestClient(\`Bearer <reauthToken>\`).auth.getUser()`, then `data.user.id === user.id`.
   - Every failure mode (missing, malformed, forged, wrong-user, stale) returns the **same** generic `401` message.
4. **Guests** (`user.is_anonymous`): `reauthToken` is not expected. Rationale — an anonymous identity has no password to re-enter, it carries only throwaway generated data, and this call deletes the identity itself. The rate limit is proportionate.
5. **Client** (`DeleteAccountDialog`): for a registered user the dialog adds a password field; on confirm it runs `signInWithPassword({ email, password })` and passes the fresh `access_token` as both the request auth and `reauthToken`. The existing "type your exact email" gate stays as the misclick guard. The guest path (type `BORRAR CUENTA`) is unchanged.
6. The privileged deletion itself (`serviceClient.auth.admin.deleteUser`) and the FK-cascade reasoning are **unchanged**.

## Consequences

- **Positive:** a stolen access token older than 5 minutes can no longer delete an account; a fresh one only can inside a very tight window, and the rate limit caps scripted attempts. Intent is now re-checked server-side, not just in a dialog. Password brute-forcing stays on Supabase Auth's hardened login surface (rate limit, leaked-password protection per FRESCO-363), never our function — consistent with ADR-0022.
- **Negative / trade-offs:** deleting a registered account now costs one extra `signInWithPassword` round-trip and a password prompt — acceptable friction for an irreversible action. A third-party caller of the raw endpoint must now obtain a fresh token first. The 5-minute window is a heuristic: an automatic token refresh also produces a fresh `iat`, so "recent `iat`" is a proxy for "recently authenticated", not a proof — but exploiting that requires the refresh token, i.e. a fuller compromise, and the rate limit still applies.
- **Neutral / follow-ups:** `delete-account` becomes the third call site of `enforceRateLimit` (after `update-recipe-status`, `reassign-guest-data`). If a stronger signal than `iat` recency is ever needed, `supabase.auth.reauthenticate()` (nonce-by-email) is the upgrade path.

## Alternatives considered

- **Rate limit only, keep the client-side gate.** Rejected: does not address the finding's core — a stolen token still deletes with no friction, just not in a tight loop.
- **Verify the password server-side in the function.** Rejected for the exact reason ADR-0022 rejected it for `reassign-guest-data`: it makes `delete-account` a password oracle outside Auth's protections and forwards a plaintext password through our infrastructure.
- **`supabase.auth.reauthenticate()` nonce flow.** Rejected for now: heavier (an email/SMS round-trip on every deletion) than the risk of a BAJO finding warrants. Left as the documented upgrade path.
- **Require MFA / step-up (`aal2`).** Rejected: this project has no MFA enrolment, so there is nothing to step up to.

## References

- `.context/ADR/ADR-0022-guest-reassignment-verify-via-session-token.md` — the pattern this reuses (verify a token, never a password).
- `.context/ADR/ADR-0010-*` — the rate-limit RPC contract reused here.
- FRESCO-397 (audit-4 A4-L11 + A4-L12) — the remediation ticket.
- `supabase/functions/delete-account/index.ts`, `supabase/functions/delete-account/reauth.ts`, `components/profile/delete-account-dialog.tsx`, `lib/api/edge-functions.ts` `deleteAccount`, `api/schemas/api-contracts.types.ts` `DeleteAccountRequest`.
