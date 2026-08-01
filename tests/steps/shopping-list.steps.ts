import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { getAccessToken } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @lista-compra,
 * STORY-FRESCO-13.
 *
 * No network mocking here, unlike @registro (signup). `ShoppingListGenerator`
 * deliberately does `router.refresh()` on a successful generate call rather
 * than trusting the client-received response body — the page always
 * re-reads the persisted list from the server as the single source of
 * truth. Mocking the wire call would leave nothing in the real DB for that
 * refresh to find, so the UI would just show the generator again — mocking
 * can't produce an observable pass here the way it did for signup. Both
 * scenarios hit the real backend (real Gemini call, real Supabase writes).
 *
 * Business Rules: at most one shopping list per plan, and the app exposes
 * no "delete list" affordance — but the RLS policy backing it
 * (`shopping_delete_own`) already lets the owning user delete their own row,
 * so each scenario resets that fixture via a direct REST call (test
 * hygiene, not a feature under test) before generating for real, keeping
 * both scenarios independently repeatable instead of one relying on a
 * previous scenario's side effect.
 */

const { Given, When, Then } = createBdd(test);

/**
 * Fixture reset — deletes this user's existing real shopping list, if any.
 * PostgREST rejects an unfiltered DELETE ("DELETE requires a WHERE
 * clause", confirmed live) even though RLS already scopes it to the
 * caller's own rows — `id=not.is.null` is an always-true filter that
 * satisfies PostgREST without narrowing what RLS already allows.
 */
async function resetShoppingListFixture(request: import('@playwright/test').APIRequestContext): Promise<void> {
  const accessToken = await getAccessToken(request, process.env.LOCAL_USER_EMAIL!, process.env.LOCAL_USER_PASSWORD!);
  await request.delete(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/shopping_lists?id=not.is.null`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function loginAndGoToShoppingList(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(process.env.LOCAL_USER_EMAIL!);
  await page.getByTestId('password_input').fill(process.env.LOCAL_USER_PASSWORD!);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
  await page.goto('/shopping-list');
}

Given(/^que el usuario tiene un menú semanal generado$/, async ({ page, request }) => {
  await resetShoppingListFixture(request);
  await loginAndGoToShoppingList(page);
  await expect(page.getByTestId('generate_shopping_list_button')).toBeVisible();
});

When(/^solicita generar la lista de la compra$/, async ({ page }) => {
  await page.getByTestId('generate_shopping_list_button').click();
  // Real Gemini call + persistence — generous timeout, no network mock (see
  // file header for why mocking this specific flow doesn't work).
  // Real Gemini generation timing varies (~10-30s observed live, retries
  // possible) — generous timeout, not tuned to a specific fast run.
  await expect(page.getByTestId('shopping_list_item_0_0')).toBeVisible({ timeout: 60_000 });
});

Then(/^el sistema consolida los ingredientes y los clasifica por pasillo$/, async ({ page }) => {
  // A real, non-empty aisle heading rendered — proves real classification
  // happened, not just an empty shell.
  // .first(): a real generation typically fills several aisles at once
  // (found live) — any one of them being visible proves real classification
  // happened, no need to match exactly one.
  await expect(page.getByText(/Frutas y verduras|Carnes y aves|Pescados y mariscos/).first()).toBeVisible();
});

Then(/^ve un resumen con el total de productos y el coste estimado$/, async ({ page }) => {
  await expect(page.getByText(/\d+ productos · estimado \d+–\d+ EUR/)).toBeVisible();
});

Given(/^que el usuario tiene una lista de la compra generada$/, async ({ page, request }) => {
  await resetShoppingListFixture(request);
  await loginAndGoToShoppingList(page);
  await page.getByTestId('generate_shopping_list_button').click();
  // Real Gemini generation timing varies (~10-30s observed live, retries
  // possible) — generous timeout, not tuned to a specific fast run.
  await expect(page.getByTestId('shopping_list_item_0_0')).toBeVisible({ timeout: 60_000 });
});

When(/^marca un producto como comprado$/, async ({ page }) => {
  await page.getByTestId('shopping_list_item_0_0').check();
});

Then(/^el producto se muestra visualmente como comprado$/, async ({ page }) => {
  await expect(page.getByTestId('shopping_list_item_0_0')).toBeChecked();
});

Then(/^el estado se conserva la próxima vez que abre la lista$/, async ({ page }) => {
  await page.reload();
  await expect(page.getByTestId('shopping_list_item_0_0')).toBeChecked();
});
