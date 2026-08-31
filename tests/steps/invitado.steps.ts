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
  await page.getByTestId('onboarding_continue_as_guest_button').click();
  await expect(page.getByTestId('step_indicator_label')).toBeVisible();
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  await page.getByTestId('presupuesto_input').fill('80');
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
