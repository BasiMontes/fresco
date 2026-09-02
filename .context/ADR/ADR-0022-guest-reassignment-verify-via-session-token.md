# ADR-0022 — Guest-data reassignment: verify target ownership via a session token, not a server-side password sign-in

- **Status:** Proposed <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-09-02
- **Deciders:** Founder (approval pending); drafted by AI workflow (FRESCO-395, audit-4 ola-3, eje Seguridad)
- **Tags:** authentication, guest-mode, security, edge-function, api-contract
- **Supersedes:** — <!-- revises the verification step of ADR-0004; ADR-0004 otherwise stands -->
- **Superseded by:** —

---

## Context

ADR-0004 established `reassign-guest-data` as the only cross-user privileged write in the codebase: a guest who tries to convert to an account that already exists proves she owns that account, and her generated data is moved to it. The ownership proof, as ADR-0004 specified it, was a **server-side `signInWithPassword({ email, password })`** run by the Edge Function against a fresh anon-key client, on credentials the caller supplied in the request body.

Audit-4 (finding A4-L4, severity BAJO) flagged the consequence: anyone can open an anonymous session for free (ADR-0003), so that endpoint is an **unauthenticated password-verification oracle**. It has no rate limit of its own, and the `signInWithPassword` call it makes sits *outside* the protections Supabase Auth applies to its own login surface — per-IP/username rate limiting, leaked-password protection (FRESCO-363 / A4-H8), optional CAPTCHA. A generic 401 hides email enumeration but does not stop an attacker from grinding candidate passwords for a known email against our function.

The `email_exists` conversion flow already, on the client, calls `signInWithPassword` for the target account immediately after the reassignment succeeds (`app/signup/page.tsx` `handleReassign`) — so the client is going to authenticate to that account through native Auth regardless. The password round-trip through our function is redundant risk.

## Decision

**We will verify target-account ownership by having the caller authenticate to the target account through native Supabase Auth and pass the resulting session token; `reassign-guest-data` verifies that token and never receives a password.**

Concretely, revising step 1 of ADR-0004's Edge Function only:

1. **Request contract** changes from `{ email, password }` to `{ targetAccessToken: string }`. The `Authorization` header still carries the guest's still-anonymous session (caller identity, unchanged).
2. **Ownership proof** is now `createRequestClient(\`Bearer <targetAccessToken>\`).auth.getUser()` — a token verification. A failure returns the same generic 401. The function additionally rejects a `targetAccessToken` whose user `is_anonymous` (the target must be a registered account) and the existing `targetUserId === guestUser.id` guard stays.
3. **Rate limit**: the function calls `check_and_increment_rate_limit` (ADR-0010, `_shared/rate-limit.ts`) keyed on the guest user id, endpoint `reassign-guest-data`, 5/hour, fail-closed. A genuine conversion hits this once.
4. **Frontend** (`handleReassign`): the proof `signInWithPassword` runs first, on a throwaway in-memory client (`persistSession: false`) so the guest session on the main client stays live until the data move completes — preserving ADR-0004's ordering guarantee (data moves while the guest identity still exists) — then the main client is switched to the real account.
5. Steps 2–4 of ADR-0004 (the `reassign_guest_data` service-role RPC, its `EXECUTE` grant boundary, the orphan-anon `deleteUser` cleanup) are **unchanged**. The SQL function signature `reassign_guest_data(uuid, uuid)` does not change.

## Consequences

- **Positive:** the brute-force surface moves from an unprotected custom function to Supabase Auth's own hardened login (rate limits, leaked-password protection, CAPTCHA option). The Edge Function no longer holds or forwards a plaintext password. A per-guest rate limit caps abuse of the endpoint itself even with valid tokens. Net reduction in blast radius for the repo's highest-risk function.
- **Negative / trade-offs:** the conversion flow now does two `signInWithPassword` calls (one throwaway for the proof, one real on the main client) instead of one — negligible cost on a rare edge-of-edge path, but it is more moving parts in the client. The client is now responsible for obtaining the target token before calling the function; a third-party caller of the raw endpoint must do the same.
- **Neutral / follow-ups:** `reassign-guest-data` becomes the second call site of the shared `enforceRateLimit` helper (after `update-recipe-status`, FRESCO-362). The `qa` testability page's request example for this function is updated to the new body shape.

## Alternatives considered

- **Keep `signInWithPassword` server-side, just add a rate limit.** Rejected: the rate limit helps but the function is still a password oracle outside Auth's protections (no leaked-password check, no CAPTCHA), and it still forwards a plaintext password through our infrastructure. The audit finding is about the mechanism, not only the missing limit.
- **Pass a short-lived signed claim minted by a separate "prove-ownership" function instead of a full session token.** Rejected: more surface (a new function, a signing key to manage) for no gain over verifying the session token Supabase already issues and validates.
- **Sign in on the main client first, then reassign (no throwaway client).** Rejected: if the reassignment call then fails transiently, the guest's data is orphaned on a now-abandoned anonymous user while she is already logged into the real account — worse than ADR-0004's current ordering, which moves the data before any session switch.

## References

- `.context/ADR/ADR-0004-guest-data-reassignment-on-email-conflict.md` — the decision this revises; only its verification step changes.
- `.context/ADR/ADR-0003-guest-auth-anonymous-sign-in.md` — free anonymous sessions are what make the oracle reachable.
- `.context/ADR/ADR-0010-*` — the rate-limit RPC contract reused here.
- FRESCO-395 (audit-4 A4-L4 + A4-L5) — the remediation ticket.
- `supabase/functions/reassign-guest-data/index.ts`, `app/signup/page.tsx` `handleReassign`, `api/schemas/api-contracts.types.ts` `ReassignGuestDataRequest`.
