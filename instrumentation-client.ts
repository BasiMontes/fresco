// ADR-0009: Next 16 convention is instrumentation-client.ts, not sentry.client.config.ts.
// ADR-0034: the SDK is dynamically imported and scheduled for idle time instead
// of a static top-level import — the client chunk was 93% unused JS on initial
// load (measured with Chrome's Coverage API). Trade-off: client errors that
// fire before this idle-scheduled load resolves are NOT captured by Sentry.
// Server + edge instrumentation (sentry.server.config.ts, sentry.edge.config.ts)
// are untouched and still capture everything per ADR-0009.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

let sentryPromise: Promise<typeof import('@sentry/nextjs')> | null = null;

async function loadSentry() {
  sentryPromise ??= import('@sentry/nextjs').then(async (Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      // Low sample rate to stay within the free tier's performance-monitoring quota.
      tracesSampleRate: 0.1,
    });
    return Sentry;
  });
  return sentryPromise;
}

if (dsn) {
  const schedule = typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 1);
  schedule(() => {
    void loadSentry();
  });
}

// Required by the SDK to instrument App Router client-side navigations
// (silences the "ACTION REQUIRED" build warning otherwise emitted). Per
// ADR-0034, a transition that starts before Sentry finishes loading is not
// instrumented — queuing/replaying it isn't worth the added complexity for a
// startup-only window.
export function onRouterTransitionStart(href: string, navigationType: string) {
  if (!dsn) {
    return;
  }
  void sentryPromise?.then(Sentry => Sentry.captureRouterTransitionStart(href, navigationType));
}
