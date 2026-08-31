import type { Page } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { restHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @notificaciones,
 * "Se puede marcar como favorita una receta recomendada directamente desde
 * Notificaciones" (FRESCO-226 Centro de Avisos).
 *
 * FRESCO-355 mini-batch. Throwaway free-plan factory user (FRESCO-308). The
 * recommendations notice renders only when the profile has a
 * `planning_selection` — seeded here via REST.
 */

const { Given, When, Then } = createBdd(test);

interface Ctx { testUser: TestUser | null }
const ctx: Ctx = { testUser: null };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function loginAndGoTo(page: Page, testUser: TestUser, path: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
  await page.goto(path);
}

Given(/^que Laura ve una receta recomendada en \/notifications$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  // The recommendations notice needs a planning_selection on the profile.
  await request.patch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${testUser.id}`, {
    headers: restHeaders(testUser.accessToken),
    data: { planning_selection: { lunes: ['comida', 'cena'] } },
  });
  await loginAndGoTo(page, testUser, '/notifications');
  await expect(page.getByTestId('notifications_recommended_recipes_notice')).toBeVisible();
});

When(/^pulsa "Guardar en favoritos" en esa tarjeta$/, async ({ page }) => {
  await page.getByTestId('notifications_recommended_recipes_notice')
    .getByRole('button', { name: 'Guardar en favoritos' })
    .first()
    .click();
});

Then(/^la receta se añade a sus favoritos, visible en \/favorites$/, async ({ page }) => {
  await page.goto('/favorites');
  await expect(page.getByTestId('favorites_grid')).toBeVisible();
  await expect(page.getByTestId('favorites_grid').getByRole('link')).toHaveCount(1);
});
