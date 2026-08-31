import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { seedFullWeekMenu } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @aprendizaje,
 * STORY-FRESCO-15. Real backend, no network mocking: marking a slot
 * cocinada/descartada is a cheap, real, terminal DB write.
 *
 * FRESCO-356: migrated off the shared `DEV_USER` account. Each scenario now
 * provisions its own throwaway factory user (FRESCO-308) with a freshly
 * seeded 21-slot plan (all `pendiente`), so nothing is shared between
 * scenarios and the suite can run in parallel (`@mode:parallel`). The
 * "pick whichever slot still has its mark buttons" dance is gone — a fresh
 * user always has all 21 slots pendiente, so `lunes_comida` is always safe.
 */

const { Given, When, Then } = createBdd(test);

/**
 * The state badge only updates after `update-recipe-status` (Edge Function)
 * round-trips. 5s is fine warm; kept generous for a cold first hit.
 */
const MARK_RESULT_TIMEOUT_MS = 20_000;

async function loginAndGoToCalendar(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(email);
  await page.getByTestId('password_input').fill(password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
  await page.goto('/calendar');
}

Given(/^que el usuario tiene un menú semanal generado con un plato en estado pendiente$/, async ({ page, request, testUserFactory, aprendizajeCtx: ctx }) => {
  ctx.testUser = await testUserFactory();
  await seedFullWeekMenu(request, ctx.testUser);
  await loginAndGoToCalendar(page, ctx.testUser.email, ctx.testUser.password);
  ctx.slotPrefix = 'calendar_slot_lunes_comida';
  await expect(page.getByTestId(`${ctx.slotPrefix}_mark_cocinada`)).toBeVisible();
});

When(/^marca ese plato como cocinado$/, async ({ page, aprendizajeCtx: ctx }) => {
  await page.getByTestId(`${ctx.slotPrefix}_mark_cocinada`).click();
});

When(/^marca ese plato como descartado$/, async ({ page, aprendizajeCtx: ctx }) => {
  await page.getByTestId(`${ctx.slotPrefix}_mark_descartada`).click();
});

Then(/^el plato se muestra como cocinado$/, async ({ page, aprendizajeCtx: ctx }) => {
  await expect(page.getByTestId(`${ctx.slotPrefix}_estado_badge`)).toHaveText('Cocinado', { timeout: MARK_RESULT_TIMEOUT_MS });
});

Then(/^el plato se muestra como descartado$/, async ({ page, aprendizajeCtx: ctx }) => {
  await expect(page.getByTestId(`${ctx.slotPrefix}_estado_badge`)).toHaveText('Descartado', { timeout: MARK_RESULT_TIMEOUT_MS });
});

Then(/^no puede volver a cambiar el estado de ese mismo plato$/, async ({ page, aprendizajeCtx: ctx }) => {
  await expect(page.getByTestId(`${ctx.slotPrefix}_mark_cocinada`)).toHaveCount(0);
  await expect(page.getByTestId(`${ctx.slotPrefix}_mark_descartada`)).toHaveCount(0);
});

Given(/^que el usuario ya marcó un plato como cocinado o descartado$/, async ({ page, request, testUserFactory, aprendizajeCtx: ctx }) => {
  ctx.testUser = await testUserFactory();
  await seedFullWeekMenu(request, ctx.testUser);
  await loginAndGoToCalendar(page, ctx.testUser.email, ctx.testUser.password);
  ctx.slotPrefix = 'calendar_slot_lunes_comida';
  await page.getByTestId(`${ctx.slotPrefix}_mark_cocinada`).click();
  await expect(page.getByTestId(`${ctx.slotPrefix}_estado_badge`)).toHaveText('Cocinado', { timeout: MARK_RESULT_TIMEOUT_MS });
});

When(/^recarga la página y observa ese mismo plato$/, async ({ page }) => {
  await page.reload();
});

Then(/^no ve ningún control para volver a marcarlo$/, async ({ page, aprendizajeCtx: ctx }) => {
  await expect(page.getByTestId(`${ctx.slotPrefix}_mark_cocinada`)).toHaveCount(0);
  await expect(page.getByTestId(`${ctx.slotPrefix}_mark_descartada`)).toHaveCount(0);
});

Then(/^el plato queda fijado en su estado actual$/, async ({ page, aprendizajeCtx: ctx }) => {
  await expect(page.getByTestId(`${ctx.slotPrefix}_estado_badge`)).toHaveText('Cocinado');
});

Given(/^que el usuario es de nivel gratuito \(Free\)$/, async ({ request, testUserFactory, aprendizajeCtx: ctx }) => {
  ctx.testUser = await testUserFactory();
  // The Free-tier notice lives inside CalendarGrid, which only renders when
  // a plan exists for the week.
  await seedFullWeekMenu(request, ctx.testUser);
});

When(/^visita \/calendar$/, async ({ page, aprendizajeCtx: ctx }) => {
  await loginAndGoToCalendar(page, ctx.testUser.email, ctx.testUser.password);
});

Then(/^ve un aviso sobre marcar cocinado\/descartado en el plan Free$/, async ({ page }) => {
  await expect(page.getByTestId('learning_free_tier_notice')).toBeVisible();
});

Then(/^ese aviso aclara que el marcado se guarda igual, y que lo exclusivo de Pro es el aprendizaje$/, async ({ page }) => {
  await expect(page.getByTestId('learning_free_tier_notice')).toContainText('se guarda igual en el plan Free');
});
