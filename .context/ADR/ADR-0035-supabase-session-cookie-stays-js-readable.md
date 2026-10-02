# ADR-0035 — Supabase session cookie stays JS-readable (no httpOnly / no BFF)

- **Status:** Accepted (2026-10-02, founder; the enforcing nonce CSP of ADR-0019 is live in production)
- **Date:** 2026-09-29
- **Deciders:** Founder (accepted 2026-10-02); AI workflow drafted
- **Tags:** security, authentication, session, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Audit-5 finding A5-H8 (split out of FRESCO-738 into FRESCO-745): the Supabase Auth
session cookie written by `@supabase/ssr` is not `httpOnly`, so any script running in the page can read the
access and refresh tokens.

What is true today, verified in the code and in the library docs:

- `httpOnly: false` is the **library default** (`DEFAULT_COOKIE_OPTIONS` in `@supabase/ssr`), documented as
  deliberate so browser JavaScript can read the token cookies. Neither `lib/supabase/client.ts` nor
  `lib/supabase/server.ts` overrides `cookieOptions`.
- `createBrowserClient` always persists the session in cookies and reads it through `document.cookie`. It is the
  component that refreshes the token and attaches it to every request.
- The browser talks to Supabase **directly with the user's JWT**: 32 `'use client'` files use
  `createClient()` / `supabase.from|rpc|functions`, and 16 files call `getSession()` / `onAuthStateChange()`
  (for example `components/auth/identity-cookie-sync.tsx`, `components/calendar/use-slot-marking.ts`,
  `app/signup/page.tsx`). Edge Functions receive the token as `Authorization: Bearer` from
  `lib/api/edge-functions.ts`. This is the RLS-by-design posture: authorization lives in Postgres policies, not in a
  server layer we own.
- Realtime is not used (no `.channel(` / `postgres_changes` in app code).
- The main attack the flag defends against, XSS reading the token, is already closed by the enforcing nonce-based
  CSP (ADR-0019: no `'unsafe-inline'` / `'unsafe-eval'` in `script-src`, `'strict-dynamic'`, Sentry CSP reporting).
- Supabase Auth is configured with `jwt_expiry = 3600`, refresh-token rotation on and
  `refresh_token_reuse_interval = 10` (`supabase/config.toml`), so a stolen access token dies within an hour and a
  replayed refresh token is detected.

## Decision

**We will keep the Supabase session cookie JS-readable (no `httpOnly`) and will not migrate to a BFF/proxy session
pattern for now.** The XSS threat is handled by the enforcing CSP (ADR-0019) plus short JWT life and refresh-token
rotation, not by cookie flags.

Invariants that make this decision safe, and that a future change must not violate:

1. The CSP in `lib/security/csp.ts` stays enforcing with per-request nonces. Weakening `script-src` (adding
   `'unsafe-inline'`, `'unsafe-eval'`, or a wildcard script host) reopens this decision.
2. Every client-readable session stays subject to RLS. Nothing privileged (service role, admin keys) ever reaches the
   browser.
3. Refresh-token rotation and reuse detection stay enabled.

Revisit (write a superseding ADR) if any of these happens:

- The CSP posture weakens, or a real XSS is found in production.
- Supabase ships an official pattern for `httpOnly` sessions that does not require the browser client to read the
  token.
- Fresco moves to a server-only data layer for other reasons (for example the ADR-0020 Pro move), which would make
  the BFF migration cheap instead of a rewrite.

## Consequences

- **Positive:** no rewrite of session architecture. The 32 client files and the direct browser-to-Supabase model
  with RLS keep working. No extra Route Handler hop or duplicated authorization logic.
- **Negative / trade-offs:** an XSS that got past the CSP could exfiltrate a refresh token and hold a session
  beyond the one-hour access token. Rotation limits replay but does not stop the first use.
- **Honest limit of `httpOnly`:** it stops token theft, not abuse. Script injected in the page can still call the
  same-origin API with the victim's cookie attached, so a BFF would reduce blast radius but not remove XSS impact.
  That is why its cost (whole-app refactor) is not justified today.
- **Neutral / follow-ups:**
  - **A shorter cookie `maxAge` is not a mitigation, and is not viable.** `@supabase/ssr` overwrites `maxAge` with
    its 400-day default on every session write (`dist/main/cookies.js` in `setItem` and `applyServerStorage`), so
    `cookieOptions.maxAge` has no effect. Making it work needs a custom `document.cookie` adapter in the browser
    plus trimming in the `setAll` of `lib/supabase/server.ts` and `proxy.ts`, which is new code in the auth path.
    Even then `maxAge` is a browser hint: whoever exfiltrates the refresh token does not honour it, so it does not
    bound a stolen session. Proposed in FRESCO-749, rejected there.
  - **The effective control is server-side:** `[auth.sessions]` `timebox` / `inactivity_timeout` invalidate the
    refresh token itself. They need the Supabase Pro plan (ADR-0020). Tracked in FRESCO-750, blocked on that
    migration.
  - The `Secure` attribute needs no action: HSTS with `preload` (ADR-0019) already forces HTTPS.

## Alternatives considered

- **Server-set `httpOnly` cookie only (override `cookieOptions.httpOnly: true` in `setAll`)** — rejected: the browser
  client can no longer read or refresh the session, so every client-side query and Edge Function call loses its
  token. It fails at runtime, not at compile time.
- **Full BFF: client never sees the token, all data through Route Handlers** — rejected for now: rewrites 32 client
  files, moves authorization out of RLS into app code we would have to keep in sync with the policies, adds latency,
  and still leaves in-session abuse under XSS. Revisit on the triggers above.
- **Hybrid (`httpOnly` for auth-only routes, JS-readable elsewhere)** — rejected: two session models to maintain and
  reason about, with no reduction in the exposed surface because the readable cookie still exists.

## References

- FRESCO-745 (this investigation), FRESCO-738 (audit-5 A5-H8, origin).
- ADR-0019 — security response headers and CSP (the load-bearing mitigation).
- ADR-0020 — single Supabase project until Pro (relevant to a future server-only data layer).
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/api/edge-functions.ts`, `supabase/config.toml`.
- `@supabase/ssr` `DEFAULT_COOKIE_OPTIONS` (`httpOnly: false`, `sameSite: lax`, `maxAge` 400 days).
