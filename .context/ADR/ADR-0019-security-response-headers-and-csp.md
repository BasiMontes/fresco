# ADR-0019 — Security response headers + Content-Security-Policy

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** Founder (approved live in-session); AI workflow drafted
- **Tags:** security, cross-cutting-invariant, http-headers, csp
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Until FRESCO-312 (audit-2 finding) production served exactly one security
response header — `Strict-Transport-Security` — and only because Vercel
auto-injects it on `*.vercel.app`. Nothing was set explicitly, so a future
custom domain would silently lose HSTS, and the app carried none of the other
standard hardening headers: no framing protection, no MIME-sniff protection,
no referrer policy, no permissions policy, and no Content-Security-Policy at
all.

The app handles real user data (auth sessions, household profiles, Stripe
subscription state) and embeds three third-party runtimes in the browser
(Supabase client + realtime, PostHog, Sentry). It has no need to be framed,
loads no `<iframe>` content it controls, and does a full-page redirect to
Stripe's hosted checkout rather than loading Stripe.js — so a strict
`frame-ancestors`/`frame-src`/`object-src` posture costs nothing.

CSP is the load-bearing control here and also the riskiest: a
mis-scoped policy breaks the whole app in production, and the third parties'
exact host sets (PostHog regional ingest + asset hosts, Sentry's multiple
`*.ingest.*.sentry.io` domains) are easy to get wrong.

## Decision

**We will set an explicit, fixed set of security response headers on every
route, and enforce a Content-Security-Policy.** Concretely:

Request-independent headers, static in `next.config.mjs` `headers()` over
`/(.*)`:

| Header | Value |
| --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` — explicit so a custom domain keeps it |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` — the app requests none |

Content-Security-Policy — a **cross-cutting invariant**: it is built once, in
`lib/security/csp.ts`, and applied from `proxy.ts` (the middleware) because a
per-request nonce cannot live in a static config header. Every new
first-party inline script or new third-party origin the browser talks to
must be reflected there, never worked around with `'unsafe-inline'`. Current
shape:

- `default-src 'self'`, `base-uri 'self'`, `object-src 'none'`,
  `frame-ancestors 'none'`, `form-action 'self'`, `frame-src 'self'`.
- `script-src 'self' 'nonce-<per-request>' 'strict-dynamic' 'wasm-unsafe-eval'`
  — no `'unsafe-inline'`, no `'unsafe-eval'` in production. `'strict-dynamic'`
  lets the nonce'd Next runtime transitively trust the bundled PostHog /
  Sentry init, so host allowlists in `script-src` are inert and none are
  listed.
- `style-src 'self' 'unsafe-inline'` — deliberately NOT nonce'd. A nonce'd
  `style-src` blocks every `style={{…}}` prop (inline style *attributes*
  cannot carry a nonce), and style injection is a much weaker XSS vector than
  script injection.
- `connect-src` / `img-src` allowlist the Supabase project origin + realtime
  `wss:` + functions origin, PostHog (regional origin + `https://*.posthog.com`
  / `https://*.i.posthog.com` wildcards), Sentry (`https://*.sentry.io` +
  `https://*.ingest{,.us,.de}.sentry.io`), `https://api.pwnedpasswords.com`
  (FRESCO-32 client-side breached-password check), and
  `https://images.unsplash.com` (recipe photos).
- `report-uri` + `report-to` point at Sentry's CSP report endpoint (derived
  from the public DSN) — kept even in enforcing mode so violations still
  surface.

## Consequences

**Positive:**
- Clickjacking, MIME-sniffing, referrer leakage, and cross-origin script
  injection are all closed off with standard controls.
- The CSP is a single source of truth (`lib/security/csp.ts`) — adding a
  third party is one edit, and the review is "did the allowlist change and
  why".
- HSTS survives a domain change instead of depending on Vercel's default.

**Negative / trade-offs:**
- Nonce-based CSP forces **every page into dynamic rendering** (a
  prerendered page has no request and no nonce, so its bootstrap would be
  CSP-blocked). `app/layout.tsx` is `export const dynamic = 'force-dynamic'`.
  Consequence: no CDN caching of HTML, no Partial Prerendering, slightly
  higher per-request server work. Accepted as the price of a real
  `'unsafe-inline'`-free `script-src`.
- The third-party host allowlists are maintenance surface: a PostHog region
  change or a new vendor is a silent breakage until the allowlist is
  updated. Mitigated by keeping `report-uri` live.
- CSP changes cannot be fully validated by unit tests or a dev build (dev
  needs `'unsafe-eval'`); a production-mode build + a Vercel-preview console
  check is part of any CSP change.

**Neutral / follow-ups:**
- FRESCO-312 shipped the header set + a **Report-Only** CSP with
  `'unsafe-inline'` as a deliberate interim (a nonce wasn't warranted for a
  medium-severity finding at that moment).
- The follow-up, FRESCO-386 / audit-4 A4-M10, took the CSP to **enforcing +
  per-request nonce + `strict-dynamic`**, dropped `'unsafe-inline'` from
  `script-src`, moved the policy from `next.config.mjs` to `proxy.ts` /
  `lib/security/csp.ts`, and added the `force-dynamic` root layout. That
  follow-up is **done** — this ADR describes the end state.
- A4-L21 (an `'unsafe-eval'` CSP report from a Next chunk in production) was
  handled by `'wasm-unsafe-eval'` (a WebAssembly source, not JS `eval`) —
  narrower than opening general `eval`.

## Alternatives considered

- **Keep CSP Report-Only indefinitely.** Rejected by A4-M10: a Report-Only
  policy with `'unsafe-inline'` blocks nothing and is not an XSS control.
- **Hash-based CSP (Subresource Integrity) instead of a nonce.** Considered
  for FRESCO-386 — it keeps static generation and CDN caching. Rejected:
  experimental in Next 16, App-Router-only, and it cannot cover
  dynamically-generated inline scripts; the nonce path is the documented,
  supported one.
- **Keep the CSP as a static `next.config.mjs` header without a nonce, just
  drop `'unsafe-inline'`.** Rejected: Next's own inline bootstrap script then
  has no way to be allowed, so the app doesn't load.
- **Allowlist third-party script hosts explicitly instead of
  `'strict-dynamic'`.** Rejected: `'strict-dynamic'` makes the allowlist
  self-maintaining for scripts (the nonce'd runtime vouches for what it
  loads), removing a whole class of "PostHog moved a host" breakage.

## References

- FRESCO-312 (audit-2 hallazgo 07) — the header set + Report-Only CSP.
- FRESCO-386 / audit-4 A4-M10 + A4-L21 — enforcing nonce CSP, this ADR's
  end state.
- `next.config.mjs` — the static header block.
- `lib/security/csp.ts` — the CSP builder (single source of truth).
- `proxy.ts` — per-request nonce + CSP application, alongside the Supabase
  session refresh.
- `app/layout.tsx` — `force-dynamic` (the nonce → all-dynamic consequence).
- ADR-0009 (Sentry) / ADR-0013 (PostHog) — the two third parties the
  `connect-src` / `report-uri` entries exist for.
