# ADR-0025 — Cookie consent gates `posthog.init()` itself, not `opt_out_capturing_by_default`

- **Status:** Proposed
- **Date:** 2026-09-07
- **Deciders:** Basi Montes
- **Tags:** compliance, privacy, analytics, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

FRESCO-428 (epic FRESCO-359, gap analysis FRESCO-365 Parte D): `app/providers/posthog-provider.tsx` calls `posthog.init()` unconditionally on mount whenever `NEXT_PUBLIC_POSTHOG_KEY` is set — no consent is asked, cookies + localStorage get written on first page load. This is an active LSSI art. 22.2 / AEPD-guide infringement, independent of whether the app ever takes payments.

PostHog's own documentation (confirmed via Context7, `/posthog/posthog.com`) recommends a specific consent pattern: always call `init()` with `opt_out_capturing_by_default: true`, then toggle `posthog.opt_in_capturing()` / `posthog.opt_out_capturing()` from the banner's callback. The story's own Acceptance Criteria, however, are written literally: "Cuando el usuario pulsa 'Rechazar' → Entonces PostHog no se inicializa" — a Gherkin scenario that a reviewer or an auditor will read literally.

This ADR exists because the two approaches are not interchangeable for a legal-compliance feature, and a future contributor extending analytics init logic needs to know which one is binding and why, rather than reaching for PostHog's own documented default.

## Decision

We will gate the `posthog.init()` call itself behind the consent decision. `PostHogProvider` never calls `posthog.init()` while the stored consent decision is `null` (undecided) or `'rejected'` — the PostHog SDK does not run at all pre-consent, not even in an opted-out state. `init()` fires only once, on the transition to `decision === 'accepted'`.

On withdrawal (an existing `'accepted'` decision changing to `'rejected'`), we explicitly call `posthog.opt_out_capturing()` (stop future capture) and delete PostHog's own persisted state ourselves — the `ph_<NEXT_PUBLIC_POSTHOG_KEY>_posthog` cookie (`document.cookie` expiry) and the matching `localStorage` key — rather than relying on internal SDK cleanup behavior that this project does not control or test. Deliberately **not** calling `posthog.reset()`: live-UI validation caught it asynchronously re-writing that same cookie with a fresh anonymous `distinct_id` moments after our explicit delete, silently resurrecting it.

## Consequences

- **Positive:** the compliance posture matches the AC's literal wording exactly ("no se inicializa" is true at the SDK level, not just "opted out"); trivially testable by asserting `posthog.init` was never called (mock call count), no need to reason about opt-out persistence internals; no analytics code executes for a visitor who never consents, which is the safest default for an auditor to verify.
- **Negative / trade-offs:** diverges from PostHog's own documented "always init, toggle opt-in/out" pattern, so a future contributor reading PostHog's docs may be surprised — this ADR is the answer to that surprise. Re-initializing PostHog fresh on first accept (rather than flipping an already-initialized SDK) means the very first page view after consenting is not captured by the already-mounted instance — acceptable, since no capture should happen before consent anyway.
- **Neutral / follow-ups:** if the app later needs a second non-essential cookie category, the same explicit-cleanup pattern (rather than relying on any single library's internal opt-out semantics) should be reused for consistency.

## Alternatives considered

- **`opt_out_capturing_by_default: true` + `opt_in_capturing()`/`opt_out_capturing()` toggle (PostHog's documented pattern).** Rejected: `init()` still runs pre-consent (SDK bootstraps, `opt_out_capturing_persistence_type` still writes a small opt-out flag by default), which is harder to defend as "no se inicializa" against a literal reading of the AC, and couples the compliance guarantee to PostHog's internal opt-out semantics rather than to code this project owns and tests directly.

## References

- FRESCO-428, FRESCO-365 (gap analysis, Parte D)
- `app/providers/posthog-provider.tsx`
- PostHog docs (Context7 `/posthog/posthog.com`): `contents/docs/privacy/data-collection.mdx`, `contents/docs/libraries/js/persistence.mdx`
- `.context/ADR/ADR-0013-posthog-product-analytics.md`
