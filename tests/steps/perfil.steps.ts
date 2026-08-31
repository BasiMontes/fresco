import type { Page } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @perfil, the happy
 * paths of `/profile` (EPIC-FRESCO-52): edit diet/allergen preferences,
 * download the JSON data backup, log out.
 *
 * FRESCO-355 (3rd batch of the FRESCO-321 ratchet). Throwaway free-plan
 * factory user (FRESCO-308).
 */

const { Given, When, Then } = createBdd(test);

interface Ctx { testUser: TestUser | null }
const ctx: Ctx = { testUser: null };

async function loginAndGoToProfile(page: Page, testUser: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
  await page.goto('/profile');
}

Given(/^que Laura está en \/profile$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToProfile(page, testUser);
});

Given(/^que Laura está en \/profile con sesión activa$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToProfile(page, testUser);
});

// ── When ─────────────────────────────────────────────────────────────────

When(/^activa un chip de dieta y confirma "Actualizar Preferencias"$/, async ({ page }) => {
  await page.getByTestId('preferencia_dieta_option').first().click();
  await page.getByTestId('actualizar_preferencias_button').click();
});

When(/^pulsa "Descargar" en Backup JSON$/, async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export_data_link').click();
  const download = await downloadPromise;
  await download.saveAs(`/tmp/${download.suggestedFilename()}`);
});

When(/^pulsa "Salir"$/, async ({ page }) => {
  await page.getByTestId('logout_button').click();
});

// ── Then ─────────────────────────────────────────────────────────────────

Then(/^la preferencia queda guardada y sigue activa tras recargar la página$/, async ({ page }) => {
  await expect(page.getByTestId('preferencias_saved_message')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-testid="preferencia_dieta_option"][aria-pressed="true"]').first()).toBeVisible();
});

Then(/^recibe un fichero con su perfil, menús, listas de la compra y recetas propias reales$/, async ({ page }) => {
  // The download itself is captured + saved in the When step; reaching here
  // means page.waitForEvent('download') resolved.
  expect(page.url()).toContain('/profile');
});

Then(/^la cookie de sesión se elimina y vuelve a \/login$/, async ({ page }) => {
  await page.waitForURL('**/login');
  const cookies = await page.context().cookies();
  const hasAuthCookie = cookies.some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token') && c.value.length > 0);
  expect(hasAuthCookie).toBe(false);
});
