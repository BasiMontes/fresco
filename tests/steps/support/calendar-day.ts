import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * FRESCO-1025. The calendar opens on today's column when it shows the current week (FRESCO-1014), so the
 * window no longer starts on Monday: on a Tuesday it shows Tuesday to Friday and `calendar_slot_lunes_*`
 * does not exist in the DOM. The scenarios seed a full week and then address the Monday slots; they passed
 * only on Mondays. This pages the window back until the day's slots are on screen, whatever day it is.
 *
 * Call it after every navigation or reload of /calendar that is followed by a slot of an earlier day: a
 * reload re-applies the "open on today" focus.
 *
 * Before the grid measures itself it renders ONE column starting on Monday, so Monday looks visible for a
 * moment and the focus then jumps to today (`use-visible-day-window.ts`). Returning at that first sighting
 * is exactly the race that left 7 scenarios failing; so it waits until React has hydrated the grid and
 * has painted the post-measurement frame, and only then pages back. It polls instead of clicking once
 * because the arrow can still be disabled for a frame after that.
 */
export async function revealCalendarDay(page: Page, dia: string): Promise<void> {
  const slots = page.locator(`[data-testid^="calendar_slot_${dia}_"]`);
  const previousDay = page.getByTestId('calendar_day_nav_prev');

  await expect(page.locator('[data-testid^="calendar_slot_"]').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const slot = document.querySelector('[data-testid^="calendar_slot_"]');
    return slot !== null && Object.keys(slot).some(key => key.startsWith('__reactFiber$'));
  }, null, { timeout: 30_000 });
  // Two frames: the measurement effect and the "open on today" focus it triggers both run after hydration.
  await page.evaluate(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });

  await expect.poll(async () => {
    if (await slots.first().isVisible()) { return true; }
    if (await previousDay.isVisible() && await previousDay.isEnabled()) { await previousDay.click(); }
    return false;
  }, { message: `the ${dia} column never became visible in the calendar window`, timeout: 15_000, intervals: [250] }).toBe(true);
}
