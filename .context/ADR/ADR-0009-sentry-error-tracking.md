# ADR-0009 — Sentry as the error-tracking vendor (client/server/edge)

- **Status:** Proposed
- **Date:** 2026-08-23
- **Deciders:** Basi Montes
- **Tags:** observability, error-tracking, cross-cutting-invariant, third-party-vendor
- **Supersedes:** —
- **Superseded by:** —

---

## Context

FRESCO-242 (tech-debt): no error tracking exists in production. `app/error.tsx` and `app/global-error.tsx` only cover Next.js client-side error boundaries — server-side, edge (middleware), and any client error not caught by those boundaries go completely unreported. The only way anyone learns about a real production error today is a manual QA sweep.

The project runs on Next.js 16 + Vercel. Two realistic options exist: a dedicated error-tracking vendor (Sentry, industry-standard for Next.js App Router) or Vercel's own built-in Observability/Logs (already included in the current plan, zero new vendor). This choice touches every runtime the app executes in (client, server, edge) and is expensive to swap later once instrumentation is wired through `instrumentation.ts` + `next.config.ts` — it passes the ADR two-gate test (architectural, hard to reverse).

## Decision

We will use **`@sentry/nextjs`** (official SDK) as the error-tracking vendor, wired across all three Next.js runtimes:

- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` — one `Sentry.init()` per runtime, DSN read from `NEXT_PUBLIC_SENTRY_DSN`.
- `instrumentation.ts` — `register()` loads the runtime-appropriate config; exports `onRequestError` (the Next 16 App Router API) to capture unhandled server-side errors.
- `next.config.ts` wrapped with `withSentryConfig` for production source-map upload (`SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`).
- Free tier (5k errors/month), `tracesSampleRate` kept low, session replay off by default.

This is the invariant future work must uphold: **Sentry is the single error-tracking sink for this app.** Any new runtime entry point (new middleware, new edge function) must route through the existing `instrumentation.ts` wiring rather than introducing a second, parallel error-reporting path.

## Consequences

- **Positive:** Full error visibility across client/server/edge for the first time. Official Next.js integration means `onRequestError` and source-map upload are first-class, not hand-rolled. Free tier covers current traffic with no cost commitment.
- **Negative / trade-offs:** New third-party vendor — new account, new DSN + auth-token secrets to manage in `.env` / Vercel env vars, new dependency (`@sentry/nextjs`) in the bundle. Build fails to upload source maps (silently, not a hard failure) if `SENTRY_AUTH_TOKEN` is absent, which could leave stack traces minified in production until someone notices and sets it.
- **Neutral / follow-ups:** `.env.example` gains `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`. Vercel Preview/Production env vars need the same sync (`/vercel-cli`) once the user creates the Sentry project and has real values. If the free tier is ever exceeded, revisit sampling rate before considering a vendor switch — a switch would supersede this ADR.

## Alternatives considered

- **Vercel Observability (native)** — rejected: no error fingerprint grouping, no configurable alerting, weaker for triage than a dedicated error tracker. Confirmed with the user before deciding (explicit choice between the two).
- **`@sentry/node` wired by hand, without the Next.js wrapper** — rejected: loses auto-instrumentation of route handlers and the built-in source-map upload pipeline that `@sentry/nextjs` provides for free.

## References

- `.context/PBI/tech-debts/TECHDEBT-FRESCO-242-monitoreo-de-errores-en-produccion-error-tracking/tech-debt.md`
- `app/error.tsx`, `app/global-error.tsx` — existing client-side boundaries this ADR extends coverage around, not replaces.
- Implementation plan: FRESCO-242 Jira comment (`Spec Implementation Plan (Dev)`), synced to `.context/PBI/tech-debts/TECHDEBT-FRESCO-242-.../comments.md`.
