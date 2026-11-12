import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { loginToApp } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @recorrido, the first-visit tour (FRESCO-1197):
 * a new account sees it once and does not see it again after skipping, and it can be replayed from
 * Configuración. The factory seeds users as having seen the tour so its overlay does not cover the other
 * scenarios; the first scenario asks for the tour with `withTour: true`.
 */

const { Given, When, Then } = createBdd(test);

Given(/^que Marta es una cuenta nueva que acaba de entrar$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory({ withTour: true });
  await loginToApp(page, testUser);
});

Then(/^ve el recorrido en la parada "([^"]+)"$/, async ({ page }, title: string) => {
  await expect(page.getByTestId('tour_dialog')).toBeVisible();
  await expect(page.getByTestId('tour_title')).toHaveText(title);
});

When(/^pulsa "Saltar" en el recorrido$/, async ({ page }) => {
  // Skipping records it on the account: wait for that write, or a quick reload would race it.
  const recorded = page.waitForResponse(response => response.url().includes('/rest/v1/user_profiles') && response.request().method() === 'PATCH');
  await page.getByTestId('tour_skip_button').click();
  expect((await recorded).ok()).toBe(true);
});

When(/^pulsa "Siguiente" en el recorrido$/, async ({ page }) => {
  await page.getByTestId('tour_next_button').click();
});

Then(/^el recorrido se cierra$/, async ({ page }) => {
  await expect(page.getByTestId('tour_dialog')).toHaveCount(0);
});

Then(/^al recargar la página no vuelve a salir$/, async ({ page }) => {
  await page.reload();
  // The overlay mounts on hydration: wait for the page to settle before asserting it is not there.
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('tour_dialog')).toHaveCount(0);
});

When(/^abre Configuración y pulsa "Ver el recorrido"$/, async ({ page }) => {
  await page.getByTestId('ayuda_row_configuracion').click();
  await expect(page.getByTestId('settings_modal')).toBeVisible();
  await page.getByTestId('ver_recorrido_button').click();
});
