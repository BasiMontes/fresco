/**
 * FRESCO-242 — Sentry init for the browser runtime. This repo is on Next.js
 * 16.2, which replaced the old `sentry.client.config.ts` convention with the
 * native `instrumentation-client.ts` file (introduced in Next 15.3 — see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * instrumentation-client.md`); Sentry's own docs confirm `sentry.client
 * .config.(js|ts)` can be safely renamed to `instrumentation-client.(js|ts)`
 * for all Next.js versions, so we use the current convention directly
 * instead of the deprecated file name from the original plan (ADR-0009).
 * No-op when the DSN is unset so local dev without Sentry credentials never
 * crashes or spams the console. Coexists with `app/error.tsx` /
 * `app/global-error.tsx` — Sentry's client init auto-instruments uncaught
 * errors and unhandled promise rejections via global handlers; it does not
 * replace or duplicate those React error boundaries.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    // Low sample rate to stay within the free tier's performance-monitoring quota.
    tracesSampleRate: 0.1,
  });
}

// Required by the SDK to instrument App Router client-side navigations
// (silences the "ACTION REQUIRED" build warning otherwise emitted).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
