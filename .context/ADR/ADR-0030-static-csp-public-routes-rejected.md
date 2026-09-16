# ADR-0030 — Reject build-time CSP nonce for static public routes

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Founder (approved live in-session)
- **Tags:** security, performance, csp, caching, cross-cutting-invariant, routing
- **Supersedes:** ADR-0029
- **Superseded by:** —

---

## Context

ADR-0029 (Accepted the same day) proposed a per-build CSP nonce for `/` and
`/sobre-nosotros`, opting those two routes out of `app/layout.tsx`'s
`force-dynamic` to regain CDN caching. FRESCO-540 was opened to implement it.

Implementation planning surfaced a constraint ADR-0029 did not account for.
`<html>`/`<body>` can only be defined once per render tree, and Next.js only
offers one supported mechanism to give a subset of routes a different
`dynamic` posture than the rest of the app: **multiple root layouts** — top-
level route groups, each with its own root layout (`node_modules/next/dist/
docs/01-app/03-api-reference/03-file-conventions/route-groups.md`). A nested
layout cannot set `dynamic` independently of an ancestor that already forces
one value app-wide (confirmed against `caching-without-cache-components.md`'s
`force-*` cross-segment rule), and cannot touch `<html>`/`<body>` at all — so
there is no way to keep the two target routes static while everything else
stays under the current single root layout.

Multiple root layouts would have required moving essentially every existing
route (`(app)/*`, `login`, `signup`, `onboarding`, `forgot-password`,
`update-password`, `legal/*`, `qa`, `dev/*`) into a second top-level group,
alongside a new group holding only the two static routes.

That mechanism has a documented cost Next.js states directly: **navigating
between two different root layouts forces a full page load**, not a
client-side transition. `/` exists to funnel visitors to `/login` and
`/signup` — under a two-root-layout split, that click, the single most
important navigation in the app, would stop being an SPA transition and pay
a full reload. `/sobre-nosotros` alone (without `/`) would not have fixed
the TTFB regression FRESCO-536 actually measured — the 1027ms figure was
recorded on `/`.

## Decision

**We will not implement ADR-0029.** `/` and `/sobre-nosotros` stay under the
single root layout, under `app/layout.tsx`'s existing `force-dynamic`
(ADR-0019/FRESCO-386). The nonce-CSP-forces-dynamic-rendering trade-off
remains accepted app-wide, with no per-route exception. FRESCO-540 closes as
Rechazos with this ADR as the record; ADR-0029 is superseded, not deleted.

## Consequences

- **Positive:** the landing page's conversion path (`/` → `/login` /
  `/signup`) keeps Next's client-side navigation — no regression introduced
  to fix a secondary metric. No route-tree restructuring risk taken on for a
  win that a full split couldn't fully deliver anyway (the `/sobre-nosotros`
  -only variant doesn't touch the actual measured TTFB route).
- **Negative / trade-offs:** the TTFB / bfcache cost FRESCO-536 measured on
  `/` (1027ms, LCP 3.3s, no back/forward cache) remains unresolved. Any
  future attempt at CDN caching for public routes needs a different
  mechanism than route-scoped `dynamic` overrides — Partial Prerendering (if
  it graduates to stable and composes with nonce CSP) or an Edge-level
  caching layer in front of the dynamic response are the more promising
  angles, neither investigated here.
- **Neutral / follow-ups:** if landing-page performance becomes pressing
  again, re-open with PPR or edge-caching as the starting hypothesis instead
  of route-group splitting — the full-page-reload cost this ADR found rules
  out the multiple-root-layouts path specifically, not caching in general.

## Alternatives considered

- **Implement ADR-0029 as written (multiple root layouts).** Rejected: the
  full-page-reload cost on landing→login/signup outweighs the TTFB win on
  the app's primary conversion action.
- **Static-only `/sobre-nosotros`, leave `/` dynamic.** Rejected: doesn't
  address the route FRESCO-536 actually measured, and still pays the same
  full-page-reload cost on any nav between the two root-layout groups
  (including `/sobre-nosotros` → `/login`), for a smaller win.
- **Accept the trade-off, close without implementing** (this decision).
  Chosen — see Decision above.

## References

- FRESCO-540 — implementation ticket that surfaced this finding; closes
  Rechazos.
- FRESCO-537 — the investigation that produced ADR-0029.
- ADR-0029 — superseded by this ADR.
- ADR-0019 — the nonce-CSP posture this ADR leaves unchanged.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`
  — "Full page load" cost of multiple root layouts.
- `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`
  — `force-*` cross-route-segment behavior.
- `app/layout.tsx` — the single root layout, unchanged.
