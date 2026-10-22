// ADR-0009: Next 16 convention is instrumentation-client.ts, not sentry.client.config.ts.
// ADR-0065 (FRESCO-1042): the browser SDK no longer starts here. It starts only after the
// visitor accepts cookies (app/providers/sentry-consent-gate.tsx), so nothing reaches Sentry
// before consent. ADR-0034 still holds: the SDK stays a dynamic import, never in the initial
// bundle. Server + edge instrumentation (sentry.server.config.ts, sentry.edge.config.ts) are
// untouched and still capture everything per ADR-0009.
import { clientSentry } from '@/lib/observability/client-sentry';
// FRESCO-1042: so Zod never probes `Function("")` (a CSP report with IP before consent).
import '@/lib/validation/zod-jitless';

// Required by the SDK to instrument App Router client-side navigations
// (silences the "ACTION REQUIRED" build warning otherwise emitted). A transition that starts
// before consent, or before the SDK finishes loading, is not instrumented (ADR-0034).
export function onRouterTransitionStart(href: string, navigationType: string) {
  void clientSentry.current?.then(Sentry => Sentry.captureRouterTransitionStart(href, navigationType));
}
