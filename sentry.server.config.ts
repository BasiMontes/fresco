/**
 * FRESCO-242 — Sentry init for the Node.js server runtime (route handlers,
 * server components, server actions). Imported from `instrumentation.ts`'s
 * `register()` when `process.env.NEXT_RUNTIME === 'nodejs'`, per
 * `@sentry/nextjs` manual setup (ADR-0009). No-op when the DSN is unset so
 * local dev without Sentry credentials never crashes or spams the console.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Low sample rate to stay within the free tier's performance-monitoring quota.
    tracesSampleRate: 0.1,
  });
}
