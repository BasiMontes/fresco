import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentWeekMonday, isoWeekOf, mondayOfWeekContaining, restHeaders } from '../test-helpers';
import { seedFullWeekMenu } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @calendario,
 * week-level controls at `/calendar`:
 *   - "Ver la semana siguiente desde el Calendario"
 *   - "Ver la semana anterior desde el Calendario"
 *   - "El usuario elimina el menú de la semana que está viendo"
 *   - "Generar un menú nuevo directamente desde el Calendario"
 *
 * FRESCO-352 (ratchet de FRESCO-321). Each scenario gets its own throwaway
 * factory user (FRESCO-308). Week navigation is plain `<Link>` navigation
 * (`?semana=YYYY-Www`); the ±2-week window (FRESCO-158) always allows ±1.
 */

const { Given, When, Then } = createBdd(test);

interface Ctx { testUser: TestUser | null }
const ctx: Ctx = { testUser: null };

/** ISO week string `delta` weeks away from the current week. */
function adjacentWeekIso(delta: number): string {
  const monday = mondayOfWeekContaining(new Date());
  monday.setUTCDate(monday.getUTCDate() + delta * 7);
  return isoWeekOf(monday);
}

async function loginAndGoToCalendar(page: import('@playwright/test').Page, testUser: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
  await page.goto('/calendar');
}

// ── Navegación de semana ──────────────────────────────────────────────────

Given(/^que el usuario está en \/calendar viendo la semana actual$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFullWeekMenu(request, testUser);
  await loginAndGoToCalendar(page, testUser);
  await expect(page.getByTestId('week_navigation')).toBeVisible();
});

When(/^toca el control de semana siguiente$/, async ({ page }) => {
  await page.getByTestId('week_nav_next').click();
});

When(/^toca el control de semana anterior$/, async ({ page }) => {
  await page.getByTestId('week_nav_prev').click();
});

Then(/^ve el menú de la semana siguiente si existe, o el estado vacío si todavía no se generó ninguno$/, async ({ page }) => {
  await expect(page).toHaveURL(new RegExp(`semana=${adjacentWeekIso(1)}`));
  await expect(page.getByTestId('calendar_empty_state')).toBeVisible();
});

Then(/^ve el menú de la semana anterior si existe, o el estado vacío si nunca se generó uno para esa semana$/, async ({ page }) => {
  await expect(page).toHaveURL(new RegExp(`semana=${adjacentWeekIso(-1)}`));
  await expect(page.getByTestId('calendar_empty_state')).toBeVisible();
});

// ── Eliminar el menú de la semana ─────────────────────────────────────────

Given(/^que el usuario ve un menú generado para la semana actual$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFullWeekMenu(request, testUser);
  await loginAndGoToCalendar(page, testUser);
  await expect(page.getByTestId('calendar_slot_lunes_comida')).toBeVisible();
});

When(/^toca el botón de eliminar$/, async ({ page }) => {
  await page.getByTestId('delete_week_button').click();
  await page.getByTestId('delete_week_confirm_button').click();
});

Then(/^el menú completo de esa semana desaparece y ve el mismo estado vacío que si nunca hubiera generado uno$/, async ({ page }) => {
  await expect(page.getByTestId('calendar_empty_state')).toBeVisible();
  await expect(page.getByTestId('calendar_slot_lunes_comida')).toHaveCount(0);
});

// ── Generar un menú desde el Calendario ───────────────────────────────────

Given(/^que el usuario está viendo una semana sin menú generado todavía$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToCalendar(page, testUser);
  await expect(page.getByTestId('calendar_empty_state')).toBeVisible();
});

When(/^toca "Generar mi menú"$/, async ({ page }) => {
  await page.getByTestId('generate_week_button').click();
});

Then(/^recibe un menú semanal completo para esa semana sin salir de \/calendar$/, async ({ page, request }) => {
  const testUser = ctx.testUser!;
  // The grid only renders a 3-day window at a time (calendar-grid.tsx), so
  // "21 huecos" is asserted against the DB, not the DOM. On screen: the
  // empty state is gone and the visible slots render.
  await expect(page.getByTestId('calendar_empty_state')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('calendar_slot_lunes_comida')).toBeVisible();
  await expect(page).toHaveURL(/\/calendar/);

  const { semanaIso } = currentWeekMonday();
  const headers = restHeaders(testUser.accessToken);
  const planRes = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans?select=id&user_id=eq.${testUser.id}&semana_iso=eq.${semanaIso}`,
    { headers },
  );
  const [plan] = await planRes.json() as { id: string }[];
  const slotsRes = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plan_recipes?select=id&meal_plan_id=eq.${plan.id}`,
    { headers },
  );
  expect((await slotsRes.json() as unknown[]).length).toBe(21);
});
