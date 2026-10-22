# ADR-0065 — The browser Sentry SDK starts only after the visitor accepts cookies

- **Status:** Accepted <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-22
- **Deciders:** Basi Montes (chose option C of FRESCO-1042 in conversation on 2026-10-22); drafted by an AI session
- **Tags:** observability, privacy, cookie-consent, error-tracking
- **Supersedes:** —
- **Superseded by:** —

---

## Context

A measurement on production (FRESCO-1042, 2026-10-22, clean browser, banner untouched) showed that every page load sent one `POST .../envelope/` to Sentry with a `session` item carrying the visitor's IP (`ip_address: "{{auto}}"`), user agent, release and environment. It happened before consent and also after pressing "Rechazar". The cause was `instrumentation-client.ts`, which started the browser SDK at idle time with no look at the consent decision (ADR-0034 only moved the start, it did not gate it). The root layout also emitted a `preconnect` to Sentry's ingest host, which opened a connection to the third party on every load.

The legal text described Sentry as technical error logging and declared only its `sentry_previous_trace` sessionStorage item. Whether sending a session with IP to a US provider without consent is acceptable is a legal question (FRESCO-365), so the owner chose the option that avoids the question.

## Decision

The browser SDK starts only while the cookie decision is `accepted`, the same gate PostHog already uses (ADR-0025):

- `lib/observability/client-sentry.ts` owns init, close and the "started" promise. The SDK stays a dynamic import (ADR-0034).
- `app/providers/sentry-consent-gate.tsx` starts it on `accepted` and closes it (`Sentry.close()`) on any other decision. A later accept starts a fresh client.
- `instrumentation-client.ts` no longer initialises anything. It keeps `onRouterTransitionStart`, which the SDK requires, and forwards to the client only when it is running.
- The `preconnect` to Sentry's ingest host is removed from `app/layout.tsx`.
- Server and edge Sentry (ADR-0009) are unchanged and capture as before.
- A second path to Sentry before consent was found after the first change shipped: the CSP `report-uri`. On pages that validate with Zod (`/login`), Zod probed `Function("")`, the enforced CSP blocked it (Zod swallows that) and the browser still posted a `csp-report` (blocked-uri `eval`, with the visitor's IP) to Sentry. `lib/validation/zod-jitless.ts` sets Zod's `jitless` option from `instrumentation-client.ts`, so the probe never runs. The CSP is not loosened and the `report-uri` stays, so real violations keep being reported.

The legal text now says that in the browser Sentry is active only after accepting cookies, and that on the servers it records service failures. `LEGAL_TEXTS_VERSION` is not bumped: the wording becomes more protective, so no earlier decision is invalidated.

## Consequences

- **Positive:** nothing reaches Sentry from the browser before the visitor chooses, and nothing at all after a rejection. A visitor who never accepts never downloads the SDK chunk.
- **Negative / trade-offs:** errors that happen in the browser of a visitor who rejected or has not decided are not captured; release health by session only covers visitors who accepted. Server-side errors still cover most real failures.
- **Neutral / follow-ups:** the Sentry project setting "do not store IP" was not verified from here and is still worth checking by the owner. The lawyer review in FRESCO-365 can confirm or relax this later.

## Alternatives considered

- **A. Keep it and declare it in the legal text:** rejected, it still sends IP without consent.
- **B. Turn off sessions only:** rejected, errors would still leave the browser before consent and the release health is lost anyway.

## References

- FRESCO-1042, FRESCO-989 (the audit that found it), FRESCO-365 (legal review).
- ADR-0009 (Sentry as the sink), ADR-0025 (consent gate strategy), ADR-0034 (deferred client init).
