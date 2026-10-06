import * as Sentry from '@sentry/nextjs';
import { sentryRelease } from '@/lib/observability/release';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // FRESCO-803: ties every error to the deploy that produced it.
    release: sentryRelease(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Low sample rate to stay within the free tier's performance-monitoring quota.
    tracesSampleRate: 0.1,
  });
}
