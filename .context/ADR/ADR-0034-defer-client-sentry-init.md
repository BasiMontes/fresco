# ADR-0034 — Defer client-side Sentry init to idle time

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Basi Montes
- **Tags:** observability, error-tracking, performance, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

FRESCO-726: after the FRESCO-719/720/721/723 PageSpeed fixes (mobile score 80 → 87), the remaining "unused JavaScript" finding is dominated by the client Sentry chunk — 358 KiB unused of a 385 KiB chunk (93%), measured with Chrome's Coverage API against `fresco-pro.vercel.app`. `instrumentation-client.ts` does a static `import * as Sentry from '@sentry/nextjs'` at module scope, so the whole SDK ships in the initial critical-path bundle regardless of whether an error ever fires.

ADR-0009 established Sentry as the single error-tracking sink across client/server/edge and set an invariant future work must uphold. This ADR does not touch that invariant — server and edge instrumentation (`sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`'s `onRequestError`) are unaffected. It narrows one thing: *when* the client SDK loads.

This passes the two-gate test (architectural, hard to reverse): it changes what class of client-side errors get reported (a monitoring-completeness trade-off, not just a perf tweak), and a future engineer debugging "why didn't Sentry catch this crash" needs to find this decision, not rediscover it from a git blame.

## Decision

We will defer `@sentry/nextjs`'s client SDK load to idle time in `instrumentation-client.ts`: replace the static top-level import with a dynamic `import('@sentry/nextjs')` scheduled via `requestIdleCallback` (falling back to `setTimeout` on browsers without it, e.g. Safari). `Sentry.init()` runs once that dynamic import resolves. `onRouterTransitionStart` queues against the same promise instead of calling `Sentry.captureRouterTransitionStart` directly.

**The invariant this establishes**: client-side errors that occur before the deferred SDK finishes loading (roughly: before the browser's first idle slot, typically within the first paint/hydration window) are **not** captured by Sentry. This is a known, accepted gap — not a bug to "fix" later by re-adding a synchronous import. Anyone who needs guaranteed capture of very-early client errors (e.g. a hydration-mismatch investigation) must reproduce with Sentry's synchronous init temporarily restored, or rely on `app/error.tsx` / `app/global-error.tsx`'s boundary-level fallback UI, which still fires regardless of Sentry's load state.

## Consequences

- **Positive:** ~358 KiB less unused JS on the initial page load's critical path; script parse/eval work for the Sentry SDK moves off the path Lighthouse measures for FCP/TBT-adjacent metrics. Server and edge error/trace capture unaffected — full coverage there per ADR-0009.
- **Negative / trade-offs:** genuine loss of visibility into the earliest class of client errors (first-paint crashes, hydration mismatches occurring before idle). `onRouterTransitionStart` navigation spans that start before Sentry loads are silently dropped, not queued and replayed — acceptable since this only affects a fast-diminishing startup window, but worth knowing when navigation-span data looks sparse for very fast initial interactions.
- **Neutral / follow-ups:** if hydration-crash blind spots become a real triage problem, the fix is not reverting this ADR — it's a targeted synchronous fallback (e.g. a tiny inline try/catch around hydration that posts directly to Sentry's envelope endpoint without the full SDK) layered on top, which would need its own ADR.

## Alternatives considered

- **Set `tracesSampleRate: 0`** — rejected: removes performance-monitoring data entirely (not just its bundle weight), a bigger observability loss than deferring load timing. Considered and explicitly declined by the user in favor of this option.
- **`bundleSizeOptimizations.excludeTracing`** — rejected: Sentry's own docs warn this breaks tracing outright when `tracesSampleRate` is in active use, which it is (ADR-0009 / FRESCO-242).
- **Leave as-is (accept ~53 KiB unused JS as the floor)** — rejected by the user; PageSpeed score still had headroom to close.

## References

- ADR-0009 — Sentry as the error-tracking vendor (the invariant this ADR narrows, not reverses).
- FRESCO-726 — Jira ticket implementation-plan comment, synced to `.context/PBI/tech-debts/TECHDEBT-FRESCO-726-.../comments.md`.
- FRESCO-724 / FRESCO-725 — prior work that reduced the same chunk 455 KiB → 385 KiB via `bundleSizeOptimizations` (Sentry v11 upgrade, Turbopack-only fix).
