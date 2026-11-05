import { describe, expect, test } from 'bun:test';
import { LEGAL_TEXTS_VERSION } from './consent';

/**
 * FRESCO-1124 — the Edge Function that sends server-side PostHog events deploys on its own and holds a
 * COPY of the legal texts version (`ANALYTICS_CONSENT_VERSION`). A bump of `LEGAL_TEXTS_VERSION` that
 * forgets the copy would silently stop every server-side event, so this fails first.
 */
describe('ANALYTICS_CONSENT_VERSION (Edge copy of LEGAL_TEXTS_VERSION)', () => {
  test('equals LEGAL_TEXTS_VERSION', async () => {
    const source = await Bun.file(new URL('../../supabase/functions/_shared/posthog.ts', import.meta.url)).text();
    const match = source.match(/export const ANALYTICS_CONSENT_VERSION = '([^']+)'/);

    expect(match?.[1]).toBe(LEGAL_TEXTS_VERSION);
  });
});
