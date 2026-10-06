import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { generateCurrentWeekPlan, seedLastWeekCookedHistory, seedPlanWarning } from '../test-user-factory';

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

// FRESCO-797 (A6-T8): both scenarios carry a real warning so the banner is on
// screen next to the card. Without it `AlertBanner` renders nothing and the
// "never mixes with the banner" step has nothing to compare against.
const AVISO_DE_PRUEBA = 'Aviso de prueba: no se pudo respetar un filtro para un hueco de la semana.';

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
  await seedPlanWarning(request, testUser, AVISO_DE_PRUEBA);
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

// FRESCO-774: no-history fallback (FRESCO-333). The factory user is Pro with
// zero marks, so nothing is seeded — the absence of history IS the precondition.
Given(/^que un usuario Pro no tiene recetas cocinadas ni descartadas en las últimas 2 semanas$/, async ({ testUserFactory }) => {
  currentTestUser = await testUserFactory({ plan: 'pro' });
});

When(/^genera el menú de la semana actual$/, async ({ page, request }) => {
  if (!currentTestUser) { throw new Error('No hay un testUser para esta escena — el Given debió ejecutarse antes.'); }
  await generateCurrentWeekPlan(request, currentTestUser);
  await seedPlanWarning(request, currentTestUser, AVISO_DE_PRUEBA);
  await page.goto('/login');
  await page.getByTestId('email_input').fill(currentTestUser.email);
  await page.getByTestId('password_input').fill(currentTestUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
});

Then(/^ve la tarjeta de aprendizaje con el mensaje de variedad y equilibrio nutricional, sin referencias a un historial inexistente$/, async ({ page }) => {
  const card = page.getByTestId('learning_explanation_card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('variedad y equilibrio nutricional');
  // The history sentences ("ya cocinaste", "descartaste", "ya te funcionaron")
  // would be a lie for a user with no history.
  await expect(card).not.toContainText(/cocinaste|descartaste|te funcionaron/);
});

// FRESCO-797 (A6-T8): this used to assert only `if (await banner.isVisible())`,
// and nothing in either scenario's setup produced a warning, so the banner was
// never rendered and the step asserted nothing, whatever the page did. Every
// check below runs every time.
Then(/^nunca se mezcla visualmente con el banner de advertencias$/, async ({ page }) => {
  const card = page.getByTestId('learning_explanation_card');
  const banner = page.getByTestId('menu_advertencias_banner');

  // Both must be on screen: with only one of them there is nothing to keep
  // apart, and a silently vanished banner (the seed above stopped working)
  // would turn this step back into a no-op.
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(AVISO_DE_PRUEBA);
  await expect(card).toBeVisible();
  const cardText = ((await card.textContent()) ?? '').trim();
  expect(cardText).not.toBe('');

  // Never rendered inside the banner.
  await expect(banner.getByTestId('learning_explanation_card')).toHaveCount(0);

  // Never the same sentence in both (a banner that shows the card's text).
  await expect(banner).not.toContainText(cardText);
});
