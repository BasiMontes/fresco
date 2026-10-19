/**
 * FRESCO-1016 (audit 7b A7-TEST-06) — does the Turnstile widget paint on /login?
 *
 * Nothing else in CI renders it: the local stack has no captcha, the e2e job blanks the site key, and the
 * post-deploy smoke obtains its session from the admin API (`E2E_SESSION_LOGIN`). A wrong site key, a CSP that
 * blocks Cloudflare, or a captcha misconfiguration would therefore lock every user out of /login and /signup
 * with every gate green. This loads the real page in a real browser and fails unless the widget is there.
 * It needs no credentials and writes nothing.
 *
 * Usage: bun scripts/check-login-widget.ts [baseUrl]   (default: LOGIN_WIDGET_URL or the staging URL)
 * Exit 0: the widget painted. Exit 1: it did not (the reason is printed). Exit 2: the check itself broke.
 */

import { chromium } from '@playwright/test';

const DEFAULT_URL = 'https://fresco-pre.vercel.app';
/** Cloudflare's script loads, runs and renders the iframe within a few seconds; this is generous. */
const WIDGET_TIMEOUT_MS = 30_000;
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

export interface WidgetVerdict {
  ok: boolean
  reasons: string[]
}

/** What was observed on the page, reduced to the facts the verdict needs. */
export interface WidgetObservation {
  turnstileApiLoaded: boolean
  /**
   * Turnstile marks a rendered widget with a hidden `cf-turnstile-response` input inside our container. With
   * `appearance: 'interaction-only'` (what /login asks for) a person who passes the silent check never gets an
   * iframe, so the iframe alone would call a healthy widget broken; either one proves it rendered.
   */
  responseInputCount: number
  iframeCount: number
  blockedRequests: string[]
  cspViolations: string[]
}

/** Pure, so the decision is tested without a browser. */
export function judgeWidget(observed: WidgetObservation): WidgetVerdict {
  const reasons: string[] = [];
  if (!observed.turnstileApiLoaded) {
    reasons.push(`window.turnstile is not defined: the script from ${TURNSTILE_ORIGIN} did not load or run`);
  }
  if (observed.responseInputCount === 0 && observed.iframeCount === 0) {
    reasons.push(`the widget container stayed empty for ${WIDGET_TIMEOUT_MS / 1000}s: no cf-turnstile-response input and no ${TURNSTILE_ORIGIN} iframe, so it was never rendered`);
  }
  for (const request of observed.blockedRequests) { reasons.push(`request to Cloudflare failed: ${request}`); }
  for (const violation of observed.cspViolations) { reasons.push(`Content-Security-Policy: ${violation}`); }
  return { ok: reasons.length === 0, reasons };
}

async function main(): Promise<number> {
  const base = (process.argv[2] ?? process.env.LOGIN_WIDGET_URL ?? DEFAULT_URL).replace(/\/$/, '');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const blockedRequests: string[] = [];
    const cspViolations: string[] = [];
    page.on('requestfailed', (request) => {
      if (request.url().startsWith(TURNSTILE_ORIGIN)) { blockedRequests.push(`${request.url()} (${request.failure()?.errorText ?? 'failed'})`); }
    });
    page.on('console', (message) => {
      // Cloudflare's own feature probe fetches `data:,` and trips connect-src on every page: not a failure.
      const text = message.text();
      if (message.type() === 'error' && /content security policy|refused to (?:load|frame)/i.test(text) && !/'data:,'|load data:,/i.test(text)) { cspViolations.push(text.slice(0, 300)); }
    });

    const response = await page.goto(`${base}/login`, { waitUntil: 'load' });
    if (!response || !response.ok()) {
      console.error(`[login-widget] ${base}/login answered ${response?.status() ?? 'nothing'}`);
      return 1;
    }

    const rendered = `[data-testid="captcha_widget"] input[name="cf-turnstile-response"], iframe[src^="${TURNSTILE_ORIGIN}"]`;
    await page.waitForSelector(rendered, { state: 'attached', timeout: WIDGET_TIMEOUT_MS }).catch(() => {});
    const observed: WidgetObservation = {
      turnstileApiLoaded: await page.evaluate(() => typeof (window as unknown as { turnstile?: unknown }).turnstile === 'object'),
      responseInputCount: await page.locator('[data-testid="captcha_widget"] input[name="cf-turnstile-response"]').count(),
      iframeCount: await page.locator(`iframe[src^="${TURNSTILE_ORIGIN}"]`).count(),
      blockedRequests,
      cspViolations,
    };

    const verdict = judgeWidget(observed);
    if (verdict.ok) {
      console.log(`[login-widget] OK: the Turnstile widget rendered on ${base}/login (response input: ${observed.responseInputCount}, iframes: ${observed.iframeCount}).`);
      return 0;
    }
    console.error(`[login-widget] FAIL on ${base}/login:\n${verdict.reasons.map(reason => `- ${reason}`).join('\n')}`);
    return 1;
  }
  finally {
    await browser.close();
  }
}

if (import.meta.main) {
  main().then(code => process.exit(code), (error) => {
    console.error('[login-widget] the check itself failed:', error);
    process.exit(2);
  });
}
