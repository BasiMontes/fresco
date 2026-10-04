import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @invitado,
 * "Una visitante nueva genera un menú sin crear cuenta".
 *
 * FRESCO-353 (2nd batch of the FRESCO-321 ratchet). The product's entry
 * point (guest mode, mvp-scope P0): a visitor with no account reaches a real
 * 21-slot menu on `/menu` backed by a real anonymous Supabase session
 * (FRESCO-17, ADR-0003) — no signup wall. Same anonymous-session bootstrap
 * pattern as `registro-progresivo.steps.ts`.
 */

const { Given, When, Then } = createBdd(test);

Given(/^que una visitante sin cuenta ni sesión visita la landing$/, async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const cookies = await page.context().cookies();
  const alreadySignedIn = cookies.some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
  expect(alreadySignedIn).toBe(false);
});

When(/^completa el onboarding de 3 pasos y genera su menú$/, async ({ page }) => {
  await page.goto('/onboarding');
  // FRESCO-197: the anonymous session is created by an explicit choice on
  // the IdentityStep ("Continuar como invitada"), not a silent mount effect.
  // FRESCO-794: age 14+ and Terms/Privacy come before anything is created.
  await page.getByTestId('confirm_age_checkbox').check();
  await page.getByTestId('accept_terms_checkbox').check();
  await page.getByTestId('onboarding_continue_as_guest_button').click();
  await expect(page.getByTestId('step_indicator_label')).toBeVisible();
  // FRESCO-371: 3-step wizard — 2 clicks reach the final step. Budget is
  // optional now, so this guest flow leaves it blank on purpose.
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  // FRESCO-755: step 3's CTA is "Ver resumen"; generation starts from the summary's "Empezar".
  await page.getByTestId('view_summary_button').click();
  await page.getByTestId('generate_menu_button').click();
  await page.waitForURL('**/menu', { timeout: 30_000 });
});

Then(/^se crea una sesión anónima real \(ADR-0003\) sin que ella lo note$/, async ({ page }) => {
  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
  expect(authCookie).toBeTruthy();
});

Then(/^ve su menú completo de 21 comidas en \/menu, sin ningún prompt de registro$/, async ({ page }) => {
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByTestId('menu_empty_state')).toHaveCount(0);
  await expect(page.getByTestId('onboarding_identity_step')).toHaveCount(0);
});

/**
 * FRESCO-794 (ADR-0040): the guest path asks for the age confirmation and the
 * Terms / Privacy acceptance before it creates a session. The wording of both
 * checkboxes is provisional (lawyer draft, not yet validated).
 */
const hasAuthCookie = async (page: import('@playwright/test').Page): Promise<boolean> => {
  const cookies = await page.context().cookies();
  return cookies.some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
};

Given(/^que una visitante sin cuenta ni sesión abre el onboarding$/, async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page.getByTestId('onboarding_identity_step')).toBeVisible();
  expect(await hasAuthCookie(page)).toBe(false);
});

When(/^pulsa "Continuar como invitada" sin marcar la edad ni los términos$/, async ({ page }) => {
  await page.getByTestId('onboarding_continue_as_guest_button').click();
});

Then(/^ve el aviso de que debe confirmar su edad y el de que debe aceptar los términos$/, async ({ page }) => {
  await expect(page.getByTestId('confirm_age_error_message')).toBeVisible();
  await expect(page.getByTestId('accept_terms_error_message')).toBeVisible();
});

Then(/^no se crea ninguna sesión y sigue en la elección de identidad$/, async ({ page }) => {
  await expect(page.getByTestId('onboarding_identity_step')).toBeVisible();
  expect(await hasAuthCookie(page)).toBe(false);
});

Then(/^al marcar las dos casillas puede continuar como invitada$/, async ({ page }) => {
  await page.getByTestId('confirm_age_checkbox').check();
  await page.getByTestId('accept_terms_checkbox').check();
  await page.getByTestId('onboarding_continue_as_guest_button').click();
  await expect(page.getByTestId('step_indicator_label')).toBeVisible();
  expect(await hasAuthCookie(page)).toBe(true);
});
