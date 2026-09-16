# ADR-0031 — Edge-cache + nonce-substitution spike: viable, partial, scoped separately

- **Status:** Proposed
- **Date:** 2026-09-16
- **Deciders:** Founder (pending sign-off)
- **Tags:** performance, csp, caching, spike
- **Supersedes:** —
- **Superseded by:** —

---

## Context

ADR-0030 rejected route-group splitting (full-page-reload cost on landing→
login/signup nav) and ruled out Partial Prerendering (Next's own docs state
PPR is incompatible with nonce-based CSP) as fixes for FRESCO-536's TTFB/
bfcache finding on `/`. Its follow-up note pointed at "an edge-level caching
layer in front of the dynamic response" as the one unexplored angle.
FRESCO-541 investigated that angle.

Vercel publishes an official Knowledge Base guide for exactly this pattern:
["How to add per-request CSP nonces to CDN-cached HTML on Vercel"](https://vercel.com/kb/guide/csp-nonces-with-cdn-cache).
Mechanism: Routing Middleware self-fetches the page through Vercel's CDN
(cached, so no full re-render), finds the nonce value baked into the cached
HTML's `<script>` tags, and substitutes a fresh one before returning the
response with a matching `Content-Security-Policy` header. The guide
explicitly leaves one question open: whether this composes with Next.js App
Router's own automatic nonce injection — it was written generically, not
tested against App Router's RSC streaming output.

**Spike finding.** Captured a real `bun run dev` render of `/` and inspected
every `<script>` tag: 62 tags total (external chunks + inline RSC-payload
`self.__next_f.push(...)` blocks), **all carrying the exact same single
nonce value**. That answers the open question — App Router doesn't need an
HTML-aware parser to retarget: a plain string replace of the one nonce value
is sufficient and low-risk (the nonce is a 44-char base64 token; false-
positive substring collisions are not a practical concern). Implemented and
tested `lib/security/nonce-substitution.ts` (`substituteNonce()`) against a
fixture built from the real captured shape — 3/3 tests green, confirms clean
substitution with zero incidental mutation elsewhere in the document.

**What the spike does NOT resolve.** The Vercel guide's returned response
carries `Cache-Control: private, no-store` — deliberately, since the
substituted nonce is unique per response and can't be shared. That means
this pattern can shave TTFB (skip the full SSR pass on a cache hit, serve a
cached-then-patched response instead) but **does not restore bfcache** —
`no-store` is exactly what breaks back/forward cache, and it stays in place
under this approach. Half of FRESCO-536's original finding (TTFB) has a real
path forward; the other half (bfcache) does not, under any option evaluated
across FRESCO-537/540/541 so far.

## Decision

**The substitution mechanic is confirmed viable and is accepted as a
building block.** Full production wiring — the self-fetch, the internal
secret header (`INTERNAL_RENDER_SECRET`), credential/header stripping, and
actual Vercel CDN cache-hit behavior in a deployed environment — is
**out of scope for this ADR and for FRESCO-541**. That is a separate,
larger implementation effort with its own risk surface (a misconfigured
self-fetch that leaks personalized markup into the shared cache is the
guide's own stated failure mode) and belongs in its own ticket, planned and
reviewed on its own terms rather than folded into a spike.

FRESCO-541 closes having answered its actual question — is the pattern
technically compatible with this app's nonce mechanism — with a tested
yes. The prototype code (`lib/security/nonce-substitution.ts` +
`.test.ts`) ships as-is: real, tested, useful groundwork, not wired into
`proxy.ts` or any request path.

## Consequences

- **Positive:** the hardest unknown (App Router + this substitution
  pattern) is answered before any infra investment, with a real test against
  real output, not a guess. `substituteNonce()` is ready to reuse when the
  production ticket picks this up.
- **Negative / trade-offs:** a future implementation ticket is still real
  work — self-fetch plumbing, secret header rotation/storage, response
  header cleanup (`CDN-Cache-Control`, `Content-Length`, `ETag`, etc.), and
  careful testing that no personalized markup ever gets cached and served
  cross-user. And even fully built, it only recovers TTFB, not bfcache.
- **Neutral / follow-ups:** if TTFB alone becomes worth the infra cost, open
  a new implementation ticket scoped narrowly to `/` (and `/sobre-nosotros`
  if it independently justifies the cost) — plan the self-fetch security
  model (credential stripping, secret rotation) as its own Stage 1, not an
  extension of this spike. bfcache stays an open problem with no known fix
  under the nonce-CSP posture; ADR-0019's trade-off holds for that half
  regardless of what happens here.

## Alternatives considered

- **Skip the spike, write the production self-fetch layer directly.**
  Rejected: the compatibility question (does App Router's nonce shape even
  work with this pattern) was genuinely unknown going in, per Vercel's own
  guide. Answering it cheaply first, before committing to secret-header
  infra and cache-security review, was the right order.
- **Treat "TTFB-only, no bfcache" as not worth pursuing at all.** Considered,
  but the founder chose to bank the confirmed-viable piece (this ADR) and
  defer the production-wiring decision to a dedicated ticket rather than
  closing the door outright.

## References

- FRESCO-541 — this spike.
- FRESCO-537 / ADR-0029 — original investigation, route-group split.
- FRESCO-540 / ADR-0030 — route-group split rejected (full-page-reload).
- Next.js `content-security-policy.md` guide — "PPR is incompatible with
  nonce-based CSP" (ruled out PPR before this ADR started).
- Vercel KB — ["How to add per-request CSP nonces to CDN-cached HTML on Vercel"](https://vercel.com/kb/guide/csp-nonces-with-cdn-cache)
  (Leo Reuter, Vercel Solutions Architect) — the pattern this spike tested.
- `lib/security/nonce-substitution.ts` + `.test.ts` — the spike's tested
  output.
- `proxy.ts`, `lib/security/csp.ts` — unchanged, still the per-request path
  for every route.
