import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @landing, the
 * public marketing page at `/` (EPIC-FRESCO-6): the page renders without a
 * session, both CTAs route to `/onboarding`, and the FAQ accordion opens one
 * question at a time.
 *
 * FRESCO-355 (3rd batch of the FRESCO-321 ratchet). No login — the page is
 * public.
 */

const { Given, When, Then } = createBdd(test);

Given(/^que un visitante sin cuenta ni sesión visita \/$/, async ({ page }) => {
  await page.goto('/');
});

Given(/^que un visitante está en la sección FAQ de \/$/, async ({ page }) => {
  await page.goto('/');
  await page.locator('#faq').scrollIntoViewIfNeeded();
});

When(/^toca una pregunta$/, async ({ page }) => {
  await page.locator('#faq button[aria-expanded]').first().click();
});

Then(/^ve la propuesta de valor, cómo funciona en 3 pasos, precios \(Free y Pro\) y FAQ$/, async ({ page }) => {
  await expect(page.locator('#como-funciona')).toBeVisible();
  await expect(page.locator('#pricing')).toContainText('Free');
  await expect(page.locator('#pricing')).toContainText('Pro');
  await expect(page.locator('#faq')).toBeVisible();
});

Then(/^ambos CTA principales \("Generar mi primer menú", "Empezar gratis"\) llevan a \/onboarding$/, async ({ page }) => {
  const ctas = page.locator('a[href="/onboarding"]');
  await expect(ctas.first()).toBeVisible();
  expect(await ctas.count()).toBeGreaterThanOrEqual(2);
});

Then(/^se expande mostrando su respuesta, sin afectar al resto de preguntas$/, async ({ page }) => {
  const buttons = page.locator('#faq button[aria-expanded]');
  await expect(buttons.first()).toHaveAttribute('aria-expanded', 'true');
  // Every OTHER question stays collapsed.
  const openCount = await page.locator('#faq button[aria-expanded="true"]').count();
  expect(openCount).toBe(1);
});

Then(/^el texto de la página no dice "con IA" ni menciona "ChatGPT"$/, async ({ page }) => {
  // FRESCO-370 (A4-H13): the engine is 100% deterministic — the landing must
  // not sell it as AI-powered nor compare it to ChatGPT.
  const bodyText = (await page.locator('body').textContent()) ?? '';
  expect(bodyText).not.toMatch(/con IA\b/i);
  expect(bodyText).not.toMatch(/ChatGPT/i);
});
