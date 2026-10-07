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

/** FRESCO-819 (A6-L10): WCAG 2.5.5 / Apple HIG touch target, the audit's 44 px floor. */
export const MIN_TOUCH_TARGET_PX = 44;

/**
 * `data-testid`s known to be under the floor, one ticket each — never add one
 * without a ticket. Emptied as tickets close.
 * - `planning_selection_cell`: 7 columns in ~270px at 360px, no room for 44px
 *   without a layout redesign (FRESCO-864).
 */
export const KNOWN_TOUCH_TARGET_ALLOWLIST: string[] = ['planning_selection_cell'];

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
].join(', ');

/**
 * Fails when any visible interactive element is smaller than `minPx` in either
 * dimension, and names each offender (tag, data-testid, size, text). A native
 * checkbox/radio is measured through its `<label>`, which is the real hit area
 * when one wraps or points at it. 1 px visually-hidden nodes (sr-only skip
 * links) are not targets and are skipped.
 */
export async function expectTouchTargetsAtLeast(
  page: Page,
  minPx: number = MIN_TOUCH_TARGET_PX,
  allowlist: string[] = KNOWN_TOUCH_TARGET_ALLOWLIST,
): Promise<void> {
  const offenders = await page.evaluate(({ selector, min, allowed }) => {
    const found: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') { continue; }
      if (allowed.includes(element.getAttribute('data-testid') ?? '')) { continue; }
      let target: HTMLElement = element;
      if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
        const label = element.closest('label') ?? (element.id ? document.querySelector<HTMLElement>(`label[for="${element.id}"]`) : null);
        if (label) { target = label; }
      }
      const { width, height } = target.getBoundingClientRect();
      if (width <= 1 && height <= 1) { continue; }
      if (width < min || height < min) {
        const testId = element.getAttribute('data-testid');
        const text = (element.textContent ?? element.getAttribute('aria-label') ?? '').trim().slice(0, 30);
        found.push(`${element.tagName.toLowerCase()}${testId ? `[${testId}]` : ''} ${Math.round(width)}x${Math.round(height)} "${text}"`);
      }
    }
    return found;
  }, { selector: INTERACTIVE_SELECTOR, min: minPx, allowed: allowlist });

  if (offenders.length > 0) {
    throw new Error(`[a11y] ${offenders.length} elemento(s) interactivo(s) < ${minPx}px en ${page.url()}:\n${offenders.map(line => `- ${line}`).join('\n')}`);
  }
}
