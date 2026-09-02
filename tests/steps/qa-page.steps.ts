import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @qa,
 * "La guía de testeabilidad en /qa es pública y muestra las 4 Edge
 * Functions reales".
 *
 * No auth, no fixture seeding — `/qa` is a public, static-content page
 * (`app/qa/page.tsx` prerenders as static, confirmed via `bun run build`).
 * The credential-safety assertion checks for env-var NAMES (the only thing
 * this page is allowed to show), not the absence of a specific real value —
 * a real value never being hardcoded in the page's source is enforced by
 * code review / grep at commit time (see `.context/bitacora.md`,
 * 2026-08-01 `/qa` launch entry), not something a live page render alone
 * can prove either way.
 */

const { Given, Then } = createBdd(test);

const EDGE_FUNCTIONS = ['generate-meal-plan', 'generate-shopping-list', 'reassign-guest-data', 'update-recipe-status'];

Given(/^que un visitante sin sesión visita \/qa$/, async ({ page }) => {
  await page.goto('/qa');
});

Then(/^ve la arquitectura, los usuarios demo y las secciones de testing DB\/API\/UI$/, async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Arquitectura' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Usuarios demo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Testing a nivel DB' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Testing a nivel API' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Testing a nivel UI' })).toBeVisible();
});

Then(/^ve una tarjeta por cada una de las 4 Edge Functions reales con su método y ruta$/, async ({ page }) => {
  for (const name of EDGE_FUNCTIONS) {
    const card = page.getByTestId(`qa_request_card_${name}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(name);
  }
});

Then(/^no ve ningún valor real de credencial, solo nombres de variables de entorno$/, async ({ page }) => {
  const bodyText = await page.locator('body').evaluate(el => el.textContent) ?? '';
  // The demo-account env-var NAMES must appear (the page's whole point) —
  // and none of them should ever be followed by an actual email/password
  // shape, which would mean a real value leaked into the static markup.
  expect(bodyText).toContain('DEV_USER_EMAIL');
  expect(bodyText).toContain('PRO_USER_EMAIL');
  expect(bodyText).not.toMatch(/@fresco\.qa/);
  expect(bodyText).not.toContain(process.env.PRO_USER_PASSWORD ?? 'never-matches');
  // FRESCO-395 (A4-L5): the Supabase project ref / Studio URL must be a
  // placeholder — never a real ~20-char ref — in this public page.
  expect(bodyText).toContain('<PROJECT_REF>');
  expect(bodyText).not.toMatch(/[a-z0-9]{20}\.(?:functions\.)?supabase\.co/);
  expect(bodyText).not.toMatch(/dashboard\/project\/[a-z0-9]{16,}/);
});
