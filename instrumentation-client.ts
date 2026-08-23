// ADR-0009: Next 16 convention is instrumentation-client.ts, not sentry.client.config.ts.
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
