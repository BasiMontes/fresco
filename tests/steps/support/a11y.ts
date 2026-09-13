import type { Page } from '@playwright/test';
import type { Result as AxeViolation } from 'axe-core';
import AxeBuilder from '@axe-core/playwright';

/**
 * FRESCO-466. Rules already known to fail, tracked by a follow-up ticket
 * each — never add one here without a ticket. Emptied as tickets close.
 */
export const KNOWN_A11Y_ALLOWLIST: string[] = [];

const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

function describeViolation(violation: AxeViolation): string {
  return `- ${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes.length} nodo(s)\n  ${violation.helpUrl}`;
}

/**
 * Runs axe-core against the current page and fails the test on any
 * serious/critical violation not covered by the allowlist. Moderate/minor
 * violations are logged as a warning so they stay visible without blocking
 * the gate.
 */
export async function expectNoA11yViolations(
  page: Page,
  options: { allowlist?: string[] } = {},
): Promise<void> {
  const allowlist = options.allowlist ?? KNOWN_A11Y_ALLOWLIST;
  // Next.js App Router briefly detaches the previous route's <title> during
  // a client-side navigation's Suspense swap — scanning in that exact
  // instant makes axe's `document-title` rule flake on a title that IS there
  // a moment later (reproduced on /recipes/[id], which has a `loading.tsx`
  // boundary). Best-effort wait, not a hard requirement: a page genuinely
  // missing a title still fails the real axe check below.
  await page.waitForFunction(() => document.title.length > 0, undefined, { timeout: 5000 }).catch(() => {});
  // FRESCO-497: `fresco-list-enter` (app/globals.css) fades list/card rows in
  // from `opacity: 0` over `--duration-fast` (250ms), staggered
  // `--duration-stagger` (40ms) apart per row, and the `action` button variant
  // (components/ui/button.tsx) runs `transition-colors` when it flips from
  // disabled to enabled a tick after mount. Both are real, intentional,
  // `prefers-reduced-motion`-gated motion — not a broken color pairing — but
  // axe measures whatever is on screen at the instant it scans, so a scan
  // mid-fade / mid-transition can catch a genuinely transient sub-4.5:1 frame
  // that never persists for a real user (reproduced this way on /onboarding,
  // /shopping-list, and intermittently /recipes — all three consumers of the
  // stagger, plus the onboarding CTA transition). Best-effort wait, not a hard
  // requirement: a page with a REAL static contrast defect still fails the
  // real axe check below once every animation has settled.
  await page.waitForFunction(
    () => document.getAnimations().every(animation => animation.playState !== 'running'),
    undefined,
    { timeout: 1000 },
  ).catch(() => {});
  const results = await new AxeBuilder({ page }).disableRules(allowlist).analyze();

  const moderateOrLower = results.violations.filter(
    violation => !BLOCKING_IMPACTS.has(violation.impact ?? ''),
  );
  if (moderateOrLower.length > 0) {
    console.warn(
      `[a11y] ${moderateOrLower.length} violación(es) no bloqueante(s) en ${page.url()}:\n${
        moderateOrLower.map(describeViolation).join('\n')}`,
    );
  }

  const blocking = results.violations.filter(violation =>
    BLOCKING_IMPACTS.has(violation.impact ?? ''),
  );
  if (blocking.length > 0) {
    throw new Error(
      `[a11y] ${blocking.length} violación(es) serious/critical en ${page.url()}:\n${
        blocking.map(describeViolation).join('\n')}`,
    );
  }
}
