/**
 * FRESCO-242 — Next.js instrumentation entry point (ADR-0009). `register()`
 * runs once per server instance and loads the runtime-appropriate Sentry
 * config, per `node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/instrumentation.md`. `onRequestError` is Next 16's
 * supported hook for reporting uncaught server-side errors (route handlers,
 * server components, server actions) — delegated straight to
 * `Sentry.captureRequestError`, the `@sentry/nextjs` helper built for this
 * exact signature (`error, request, context`).
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
