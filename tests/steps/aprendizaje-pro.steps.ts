import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { generateCurrentWeekPlan, seedLastWeekCookedHistory } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @aprendizaje,
 * "El usuario Pro ve la tarjeta de explicación en /menu" (FR-5.5,
 * FRESCO-22).
 *
 * FRESCO-308: used to force `plan = 'pro'` plus 2 weeks of real history onto
 * the shared `PRO_USER_EMAIL` account (a live 500 "Error guardando el plan
 * en la BD" was observed here, racing against another scenario on the same
 * account). Now creates its own throwaway Pro-tier user via `testUserFactory`
 * (`tests/test-user-factory.ts`), so this scenario's real generation call
 * never contends with anything else in the suite.
 *
 * Real generation (real isPro branch, real history read) — no mocking here,
 * same acceptance as @lista-compra: a network mock can't produce a real
 * card-insight to assert against. Deterministic since ADR-0005/ADR-0006 —
 * no Gemini call anywhere in this path anymore.
 */

const { Given, When, Then } = createBdd(test);

let currentTestUser: TestUser | null = null;

Given(/^que un usuario Pro tiene explicacion_aprendizaje no nula en su menú$/, async ({ request, testUserFactory }) => {
  const testUser = await testUserFactory({ plan: 'pro' });
  currentTestUser = testUser;

  // Real history requires a real Pro-tier profile — get_recent_recipe_marks()
  // (ADR-0006) is read unconditionally by index.ts once isPro is true
  // server-side. Seed a real "last week" plan, all slots `cocinada`, so it
  // finds real cocinada/descartada history for this account — `pendiente`
  // slots would no longer count as history since FRESCO-120.
  await seedLastWeekCookedHistory(request, testUser);

  // Real generation for the CURRENT week — real isPro branch, real history
  // read, deterministic (no Gemini call, ADR-0005/ADR-0006). No mock: a
  // network-mocked response can't produce a real card-insight to assert
  // against.
  await generateCurrentWeekPlan(request, testUser);
});

When(/^visita \/menu$/, async ({ page }) => {
  if (!currentTestUser) { throw new Error('No hay un testUser sembrado para esta escena — el Given debió ejecutarse antes.'); }
  await page.goto('/login');
  await page.getByTestId('email_input').fill(currentTestUser.email);
  await page.getByTestId('password_input').fill(currentTestUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
});

Then(/^ve una tarjeta "card-insight" con esa explicación$/, async ({ page }) => {
  const card = page.getByTestId('learning_explanation_card');
  await expect(card).toBeVisible();
  await expect(card).not.toHaveText('');
});

Then(/^nunca se mezcla visualmente con el banner de advertencias$/, async ({ page }) => {
  const cardText = await page.getByTestId('learning_explanation_card').textContent();
  const banner = page.getByTestId('menu_advertencias_banner');
  if (await banner.isVisible()) {
    const bannerText = await banner.textContent();
    expect(bannerText).not.toContain(cardText);
  }
});
