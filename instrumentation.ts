import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// ADR-0009: onRequestError is Next 16's hook for uncaught server-side errors.
export const onRequestError = Sentry.captureRequestError;
