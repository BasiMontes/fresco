# ADR-0029 — Build-time CSP nonce for fully-static public routes

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Founder (approved live in-session)
- **Tags:** security, performance, csp, caching, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

FRESCO-537 (spin-off of FRESCO-536, PageSpeed mobile audit) measured the cost
of ADR-0019/FRESCO-386's per-request nonce CSP: `/` on fresco-pro shows
TTFB 1027ms (drags FCP/LCP to 3.3s) and `Cache-Control: no-store`, so back/
forward cache is broken on mobile navigation. Root cause: `proxy.ts` stamps a
fresh CSP nonce on every request, which forces `app/layout.tsx` into
`dynamic = 'force-dynamic'` app-wide — no CDN caching, no ISR, no PPR,
regardless of whether the route has anything request-specific to render.

This was deliberately NOT fixed inside FRESCO-536 because it reopens a
security posture the founder already ratified (ADR-0019). FRESCO-537's scope
was investigation only — answer whether a subset of routes can regain
caching without weakening `script-src`, and land the answer as an ADR before
any code changes to `proxy.ts`.

New evidence found during the investigation, not present when ADR-0019 was
written: `/` and `/sobre-nosotros` do not read the Supabase session
server-side at all. `components/landing/site-nav.tsx` determines guest vs
logged-in state entirely client-side via `hasSupabaseSessionCookie()`
(`lib/supabase/session-cookie.ts`, shipped in FRESCO-539) — a synchronous
cookie-prefix check, no server call. So `proxy.ts`'s other job on these two
routes (Supabase session-cookie refresh) is also unnecessary, not just the
nonce.

ADR-0019 already evaluated and rejected two adjacent options for the whole
app: hash-based CSP (experimental in Next 16, App-Router-only, can't cover
RSC-streamed inline scripts) and a static nonce-less header (Next's own
inline bootstrap script would have no way to be allowed without
`'unsafe-inline'`). Neither of those rulings covered a **per-build** nonce
scoped to a small allowlist of genuinely static, unauthenticated,
non-personalized routes — that is the option this ADR evaluates.

## Decision

**We will carve a narrow, audited exception into ADR-0019's nonce-CSP
posture.** For a short, explicit allowlist of fully-static public routes
(`/`, `/sobre-nosotros` today — legal pages if they become server-rendered
later),

1. Override `dynamic = 'force-static'` on those route segments (opting out
   of the root layout's app-wide `force-dynamic`).
2. Generate one CSP nonce **per build** (not per request) — a random value
   computed once during the Vercel build step, exported as a build-time env
   var.
3. Exclude those routes from `proxy.ts`'s matcher, so they skip both the
   session-cookie refresh (confirmed unnecessary — see Context) and the
   per-request nonce.
4. Serve their CSP via a static header (`next.config.mjs`, alongside the
   existing HSTS/X-Frame-Options block) carrying the build-time nonce,
   matching the nonce baked into the prerendered HTML at the same build.

Because the HTML is identical for every visitor until the next deploy, a
same-nonce-for-everyone header is not a materially weaker guarantee than
hash-based CSP for that content — the deploy boundary is the trust boundary,
same as a hash would be, without hash-based CSP's RSC-streaming limitation.
Every other route (anything authenticated, anything with per-user or
per-request content) keeps the existing per-request nonce from `proxy.ts`
unchanged.

Implementation is a separate, follow-up ticket — this ADR settles the
posture, not the code.

## Consequences

- **Positive:** `/` regains CDN caching and back/forward cache on mobile.
  Local measurement (zero network latency) showed Lighthouse Performance
  78→91 when the dynamic-SSR cost was removed, isolating TTFB as the
  dominant remote-only cost — the caching win is expected to recover most of
  that gap in production. `script-src` stays nonce'd with no
  `'unsafe-inline'` anywhere; ADR-0019's actual security fix (A4-M10) is
  preserved unchanged.
- **Negative / trade-offs:** two CSP code paths instead of one (per-request
  in `proxy.ts`, per-build in `next.config.mjs`) — a route added to the
  static allowlist without auditing it for personalization risks silently
  serving stale, wrong, or leaked per-user content from the CDN, which is a
  worse failure mode than a slow TTFB. The allowlist must stay small and
  each addition must be a deliberate audit, not a default. The build-time
  nonce needs a CI/build-step change (compute + thread through Vercel's
  build environment) that does not exist yet.
- **Neutral / follow-ups:** if Accepted, a separate implementation ticket
  executes the `proxy.ts` matcher change, the `force-static` overrides, the
  build-step nonce generation, and the `next.config.mjs` header — this ADR
  only settles whether the posture is acceptable, not the code. Any future
  route added to the allowlist must be re-audited against the same
  no-server-side-session-read condition confirmed here for `/` and
  `/sobre-nosotros`.

## Alternatives considered

- **Exclude public routes from the matcher with no nonce (`'unsafe-inline'`
  fallback for those routes only).** Rejected: defeats A4-M10's actual XSS
  fix on the app's highest-traffic, first-contact route — worst place to
  reopen it.
- **Hash-based CSP app-wide.** Already rejected in ADR-0019: experimental in
  Next 16, App-Router-only, cannot cover dynamically-generated/streamed
  inline scripts. Re-confirmed still true for FRESCO-537 — this ADR's
  build-time-nonce option sidesteps the RSC-streaming problem entirely by
  only applying to routes with zero server-rendered per-request content.
  Full app-wide hash-based CSP remains rejected.
  ISR with per-deploy purge, without a matching static-CSP mechanism, was
  also considered and folds into this same option once the nonce question is
  answered — ISR alone doesn't resolve the CSP nonce, both have to move
  together.
- **Leave as-is (accepted trade-off, no change).** Legitimate fallback if the
  founder judges the caching win not worth a second CSP code path. Captured
  here so it isn't silently re-litigated: the performance cost is real and
  measured, but ADR-0019's trade-off was made deliberately and holds until
  this ADR is Accepted.

## References

- FRESCO-537 — this investigation.
- FRESCO-536 — the PageSpeed mobile audit that surfaced the TTFB finding.
- ADR-0019 — the ratified nonce-CSP posture this ADR proposes to carve a
  narrow, audited exception into (not replace).
- `proxy.ts` — per-request nonce + session refresh, matcher to be narrowed
  if Accepted.
- `lib/security/csp.ts` — the per-request CSP builder; a build-time variant
  would live alongside it.
- `app/layout.tsx` — the `force-dynamic` export the allowlisted routes would
  override.
- `lib/supabase/session-cookie.ts`, `components/landing/site-nav.tsx`
  (FRESCO-539) — the client-side guest/session-cookie check that makes the
  session-refresh exclusion safe for `/` and `/sobre-nosotros`.
