import { sentryRelease } from '@/lib/observability/release';

type SentrySdk = typeof import('@sentry/nextjs');

/**
 * FRESCO-1042 / ADR-0065: the browser SDK starts only after the visitor accepts cookies and is
 * closed again when they withdraw. Before this, an idle-time init sent one `session` envelope
 * (IP included) per page load to Sentry, even after pressing "Rechazar".
 *
 * The SDK stays a dynamic import (ADR-0034): the chunk is 93% unused on first paint, and a
 * visitor who never accepts never downloads it. `loadSdk` is a parameter so tests can pass a
 * fake without mocking the module.
 */
export function createClientSentry(loadSdk: () => Promise<SentrySdk>, dsn: string | undefined) {
  let started: Promise<SentrySdk> | null = null;

  return {
    start(): Promise<SentrySdk> | null {
      if (!dsn) {
        return null;
      }
      started ??= loadSdk().then((Sentry) => {
        Sentry.init({
          dsn,
          // FRESCO-803: ties every error to the deploy that produced it.
          release: sentryRelease(),
          environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
          // Low sample rate to stay within the free tier's performance-monitoring quota.
          tracesSampleRate: 0.1,
        });
        return Sentry;
      });
      return started;
    },

    /** Withdrawal: stop sending and let a later accept start a fresh client. */
    async stop(): Promise<void> {
      const pending = started;
      started = null;
      if (pending) {
        const Sentry = await pending;
        await Sentry.close();
      }
    },

    /** `null` until the SDK has been started, so a transition before consent is not instrumented. */
    get current(): Promise<SentrySdk> | null {
      return started;
    },
  };
}

export const clientSentry = createClientSentry(
  async () => import('@sentry/nextjs'),
  process.env.NEXT_PUBLIC_SENTRY_DSN,
);
