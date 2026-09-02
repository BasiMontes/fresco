import { describe, expect, it } from 'bun:test';
import { buildContentSecurityPolicy, sentryCspReportUri, toOrigin } from '@/lib/security/csp';

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL: 'https://abc.functions.supabase.co',
  NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
  NEXT_PUBLIC_SENTRY_DSN: 'https://key123@o1.ingest.de.sentry.io/456',
};

function directive(csp: string, name: string): string {
  return csp.split('; ').find(d => d.startsWith(`${name} `)) ?? '';
}

describe('toOrigin', () => {
  it('returns the origin, or null for junk', () => {
    expect(toOrigin('https://x.supabase.co/rest/v1')).toBe('https://x.supabase.co');
    expect(toOrigin('not a url')).toBeNull();
    expect(toOrigin(undefined)).toBeNull();
  });
});

describe('sentryCspReportUri', () => {
  it('builds the security report endpoint from the DSN', () => {
    expect(sentryCspReportUri('https://key123@o1.ingest.de.sentry.io/456')).toBe(
      'https://o1.ingest.de.sentry.io/api/456/security/?sentry_key=key123',
    );
    expect(sentryCspReportUri(undefined)).toBeNull();
    expect(sentryCspReportUri('https://o1.ingest.de.sentry.io/456')).toBeNull();
  });
});

describe('buildContentSecurityPolicy', () => {
  it('hardens script-src: nonce + strict-dynamic, no unsafe-inline, no unsafe-eval in prod', () => {
    const csp = buildContentSecurityPolicy({ nonce: 'abc123', isDev: false }, ENV);
    const script = directive(csp, 'script-src');
    expect(script).toContain('\'nonce-abc123\'');
    expect(script).toContain('\'strict-dynamic\'');
    expect(script).not.toContain('\'unsafe-inline\'');
    expect(script).not.toContain('\'unsafe-eval\'');
    expect(script).toContain('\'wasm-unsafe-eval\'');
  });

  it('adds unsafe-eval only in development', () => {
    expect(directive(buildContentSecurityPolicy({ nonce: 'n', isDev: true }, ENV), 'script-src'))
      .toContain('\'unsafe-eval\'');
  });

  it('keeps style-src unsafe-inline (only script-src is hardened)', () => {
    expect(directive(buildContentSecurityPolicy({ nonce: 'n', isDev: false }, ENV), 'style-src'))
      .toBe('style-src \'self\' \'unsafe-inline\'');
  });

  it('allowlists Supabase, PostHog, Sentry and the pwned-passwords API in connect-src', () => {
    const connect = directive(buildContentSecurityPolicy({ nonce: 'n', isDev: false }, ENV), 'connect-src');
    expect(connect).toContain('https://abc.supabase.co');
    expect(connect).toContain('wss://abc.supabase.co');
    expect(connect).toContain('https://abc.functions.supabase.co');
    expect(connect).toContain('https://*.posthog.com');
    expect(connect).toContain('https://*.ingest.de.sentry.io');
    expect(connect).toContain('https://api.pwnedpasswords.com');
  });

  it('includes report-uri + report-to only when a report URI is given', () => {
    const withReport = buildContentSecurityPolicy({ nonce: 'n', isDev: false, reportUri: 'https://r/report' }, ENV);
    expect(withReport).toContain('report-uri https://r/report');
    expect(withReport).toContain('report-to csp-endpoint');

    const without = buildContentSecurityPolicy({ nonce: 'n', isDev: false }, ENV);
    expect(without).not.toContain('report-uri');
    expect(without).not.toContain('report-to');
  });

  it('always locks down the framing / object / base-uri primitives', () => {
    const csp = buildContentSecurityPolicy({ nonce: 'n', isDev: false }, ENV);
    expect(csp).toContain('frame-ancestors \'none\'');
    expect(csp).toContain('object-src \'none\'');
    expect(csp).toContain('base-uri \'self\'');
    expect(csp).toContain('upgrade-insecure-requests');
  });
});
