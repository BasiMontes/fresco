import type { APIRequestContext, Page } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { restHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @favoritos, the
 * happy paths of `/favorites` (EPIC-FRESCO-64/FRESCO-171): see the list,
 * remove from the list, cross-screen consistency, open a favourite's detail.
 *
 * FRESCO-355 (3rd batch of the FRESCO-321 ratchet). Throwaway free-plan
 * factory user (FRESCO-308); a favourite is seeded via the `favorites` table
 * with the user's own token (RLS `favorites_insert_own`).
 */

const { Given, When, Then } = createBdd(test);

interface Ctx { testUser: TestUser | null, favRecipeName: string }
const ctx: Ctx = { testUser: null, favRecipeName: '' };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function seedFavorite(request: APIRequestContext, testUser: TestUser): Promise<void> {
  const headers = restHeaders(testUser.accessToken);
  const res = await request.get(`${SUPABASE_URL}/rest/v1/recipes?select=id,nombre&limit=1`, { headers });
  const [recipe] = await res.json() as { id: string, nombre: string }[];
  ctx.favRecipeName = recipe.nombre;
  const insert = await request.post(`${SUPABASE_URL}/rest/v1/favorites`, {
    headers,
    data: { user_id: testUser.id, recipe_id: recipe.id },
  });
  if (!insert.ok()) { throw new Error(`seedFavorite failed: ${insert.status()} ${await insert.text()}`); }
}

async function loginAndGoTo(page: Page, testUser: TestUser, path: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
  await page.goto(path);
}

Given(/^que Laura tiene al menos una receta marcada como favorita$/, async ({ request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFavorite(request, testUser);
});

Given(/^que Laura está en \/favorites con al menos una receta guardada$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFavorite(request, testUser);
  await loginAndGoTo(page, testUser, '/favorites');
  await expect(page.getByTestId('favorites_grid')).toBeVisible();
});

Given(/^que Laura marca una receta como favorita desde \/menu o \/notifications$/, async ({ request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFavorite(request, testUser);
});

Given(/^que Laura está en \/favorites$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedFavorite(request, testUser);
  await loginAndGoTo(page, testUser, '/favorites');
});

// ── When ─────────────────────────────────────────────────────────────────

When(/^abre \/favorites$/, async ({ page }) => {
  await loginAndGoTo(page, ctx.testUser!, '/favorites');
});

When(/^pulsa "Quitar de favoritos" en una de las tarjetas$/, async ({ page }) => {
  await page.getByTestId('favorites_grid').getByRole('button', { name: 'Quitar de favoritos' }).first().click();
});

When(/^visita \/favorites, o el detalle de esa misma receta, o vuelve a la pantalla de origen$/, async ({ page }) => {
  await loginAndGoTo(page, ctx.testUser!, '/favorites');
});

When(/^toca una tarjeta de receta favorita$/, async ({ page }) => {
  await page.getByTestId('favorites_grid').getByRole('link').first().click();
  await page.waitForURL('**/recipes/**');
});

// ── Then ─────────────────────────────────────────────────────────────────

Then(/^ve una tarjeta por cada receta favorita, con imagen, nombre, categoría y tiempo\/coste$/, async ({ page }) => {
  await expect(page.getByTestId('favorites_grid')).toBeVisible();
  await expect(page.getByTestId('favorites_grid').getByRole('link')).toHaveCount(1);
  await expect(page.getByTestId('favorites_grid')).toContainText(ctx.favRecipeName);
});

Then(/^la tarjeta desaparece inmediatamente de la lista$/, async ({ page }) => {
  await expect(page.getByTestId('favorites_empty_state')).toBeVisible();
});

Then(/^el cambio persiste tras recargar la página$/, async ({ page }) => {
  await page.reload();
  await expect(page.getByTestId('favorites_empty_state')).toBeVisible();
});

Then(/^el estado de favorito \(marcado o no\) es el mismo en todas ellas$/, async ({ page }) => {
  await expect(page.getByTestId('favorites_grid')).toContainText(ctx.favRecipeName);
  await page.getByTestId('favorites_grid').getByRole('link').first().click();
  await page.waitForURL('**/recipes/**');
  await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toBeVisible();
});

Then(/^ve el detalle completo de esa receta, con el botón de favorito ya marcado$/, async ({ page }) => {
  await expect(page.getByTestId('recipe_detail_ingredientes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toBeVisible();
});
