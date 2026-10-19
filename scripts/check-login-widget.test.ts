import { describe, expect, test } from 'bun:test';
import { judgeWidget } from './check-login-widget';

/** FRESCO-1016 (A7-TEST-06): the decision of the scheduled /login check, without a browser. */
const healthy = { turnstileApiLoaded: true, responseInputCount: 1, iframeCount: 0, blockedRequests: [], cspViolations: [] };

describe('judgeWidget', () => {
  test('a rendered widget with the silent check passed (no iframe) is healthy', () => {
    expect(judgeWidget(healthy)).toEqual({ ok: true, reasons: [] });
  });

  test('an interactive challenge (iframe, no response input yet) is healthy too', () => {
    expect(judgeWidget({ ...healthy, responseInputCount: 0, iframeCount: 1 }).ok).toBe(true);
  });

  test('an empty container fails: a wrong site key or a missing key renders nothing', () => {
    const verdict = judgeWidget({ ...healthy, responseInputCount: 0, iframeCount: 0 });

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.join(' ')).toContain('never rendered');
  });

  test('the Cloudflare script not running fails', () => {
    const verdict = judgeWidget({ ...healthy, turnstileApiLoaded: false });

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons[0]).toContain('window.turnstile is not defined');
  });

  test('a blocked Cloudflare request or a CSP violation is reported even if something rendered', () => {
    const verdict = judgeWidget({ ...healthy, blockedRequests: ['https://challenges.cloudflare.com/x (blocked)'], cspViolations: ['frame-src refused'] });

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toHaveLength(2);
  });
});
