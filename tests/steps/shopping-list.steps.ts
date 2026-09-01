import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { restHeaders } from '../test-helpers';
import { generateCurrentWeekPlan } from '../test-user-factory';

/** Mirrors `supabase/functions/_shared/normalize.ts` — can't import across the Deno/Node boundary, small enough to duplicate for test-only overlap checks. */
function normalizeNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n');
}

/**
 * Step definitions for `.context/qa/regression.feature` — @lista-compra,
 * STORY-FRESCO-13.
 *
 * No network mocking here, unlike @registro (signup). The whole flow hits
 * the real backend (real Supabase writes; the shopping-list generation is
 * fully deterministic — consolidation + a static aisle map, no LLM, see
 * `supabase/functions/generate-shopping-list/index.ts`).
 *
 * FRESCO-367 (A4-H10): `/shopping-list` now generates the list AUTOMATICALLY
 * on the first visit (server-side, `ensureShoppingListForPlan`) — there is no
 * manual "Generar" step in the happy path anymore. `ShoppingListGenerator`
 * (the button) only renders as a fallback if that lazy generation failed, so
 * these steps just navigate and wait for the list to appear.
 *
 * FRESCO-308: each scenario creates its own throwaway user via
 * `testUserFactory` (`tests/test-user-factory.ts`) and generates that user's
 * own real current-week menu first — no shared account to reset.
 */

const { Given, When, Then } = createBdd(test);

async function seedMenuAndLoginToShoppingList(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  testUserFactory: () => Promise<TestUser>,
): Promise<TestUser> {
  const testUser = await testUserFactory();
  await generateCurrentWeekPlan(request, testUser);

  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
  await page.goto('/shopping-list');
  return testUser;
}

Given(/^que el usuario tiene un menú semanal generado$/, async ({ page, request, testUserFactory }) => {
  await seedMenuAndLoginToShoppingList(page, request, testUserFactory);
});

When(/^abre la lista de la compra$/, async ({ page }) => {
  await page.goto('/shopping-list');
  // FRESCO-367: the list is generated server-side on this visit — no button
  // click. Deterministic (no LLM), but a generous timeout for a cold CI
  // backend + the one-time consolidation write.
  await expect(page.getByTestId('shopping_list_item_0_0')).toBeVisible({ timeout: 30_000 });
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
  // Two separate assertions, not one combined regex — FRESCO-191's visual
  // pass (2026-08-13) split "X productos · estimado Y-Z EUR" into a
  // pendientes count and a "Total estimado" figure in separate DOM nodes
  // (Resumen card), so a single cross-node text match no longer applies.
  await expect(page.getByText(/\d+ artículos? pendientes?/)).toBeVisible();
  // The "Total estimado" figure renders as `min–max€` with a comma decimal and
  // a trailing `€` (shopping-list-view.tsx `formatPrecio` — matches the app's
  // "2,80€/persona" convention), not "Y-Z EUR".
  await expect(page.getByText(/\d+(,\d+)?–\d+(,\d+)?€/)).toBeVisible();
});

Given(/^que el usuario tiene una lista de la compra generada$/, async ({ page, request, testUserFactory }) => {
  await seedMenuAndLoginToShoppingList(page, request, testUserFactory);
  // FRESCO-367: generated automatically on the /shopping-list visit above.
  await expect(page.getByTestId('shopping_list_item_0_0')).toBeVisible({ timeout: 30_000 });
});

When(/^marca un producto como comprado$/, async ({ page }) => {
  await page.getByTestId('shopping_list_item_0_0').check();
});

Then(/^el producto se muestra visualmente como comprado$/, async ({ page }) => {
  await expect(page.getByTestId('shopping_list_item_0_0')).toBeChecked();
});

// ── Precio por producto (FRESCO-191, segunda vuelta) ────────────────────────

Then(/^cada producto muestra su cantidad, unidad y precio estimado$/, async ({ page }) => {
  // Real deterministic price (aisle-pricing.ts), same format the app uses
  // elsewhere ("2,80€" — comma decimal, no space, per recipe-card.tsx).
  await expect(page.getByText(/\d+(,\d+)? \S+ · \d+,\d{2}€/).first()).toBeVisible();
});

Then(/^el precio se conserva la próxima vez que abre la lista$/, async ({ page }) => {
  await page.reload();
  await expect(page.getByText(/\d+(,\d+)? \S+ · \d+,\d{2}€/).first()).toBeVisible();
});

// ── Compra realizada (FRESCO-191, QA rework; copy per FRESCO-215) ──────────

Given(/^que el usuario tiene una lista de la compra generada con un producto marcado como comprado$/, async ({ page, request, testUserFactory }) => {
  await seedMenuAndLoginToShoppingList(page, request, testUserFactory);
  await expect(page.getByTestId('shopping_list_item_0_0')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('shopping_list_item_0_0').check();
  await expect(page.getByTestId('shopping_list_item_0_0')).toBeChecked();
});

When(/^pulsa "Compra realizada"$/, async ({ page }) => {
  await page.getByTestId('shopping_list_clear_comprados_button').click();
});

Then(/^todos los productos quedan desmarcados$/, async ({ page }) => {
  await expect(page.getByTestId('shopping_list_item_0_0')).not.toBeChecked();
});

Then(/^el botón "Compra realizada" desaparece$/, async ({ page }) => {
  await expect(page.getByTestId('shopping_list_clear_comprados_button')).toHaveCount(0);
});

// ── Sugerencias basadas en favoritos (FRESCO-194) ───────────────────────────

Given(
  /^que el usuario tiene una lista de la compra generada y una receta favorita con un ingrediente que no está en la lista$/,
  async ({ page, request, testUserFactory }) => {
    const testUser = await seedMenuAndLoginToShoppingList(page, request, testUserFactory);
    await expect(page.getByTestId('shopping_list_item_0_0')).toBeVisible({ timeout: 30_000 });

    const headers = restHeaders(testUser.accessToken);
    const userId = testUser.id;

    // Real ingredient names already on the just-generated list, normalized
    // the same way get-shopping-list-suggestions excludes against.
    const listRes = await request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/shopping_lists?user_id=eq.${userId}&select=items`,
      { headers },
    );
    const [list] = await listRes.json() as { items: { items: { nombre: string }[] }[] }[];
    const enLista = new Set(
      list.items.flatMap(pasillo => pasillo.items.map(item => normalizeNombre(item.nombre))),
    );

    // A real catalog recipe whose ingredientes_principales are ENTIRELY
    // disjoint from the just-generated list — guarantees the suggestion
    // carousel has something to show, deterministically, instead of hoping
    // a fixed recipe id happens not to overlap this run's random menu.
    const recipesRes = await request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/recipes?select=id,ingredientes_principales&limit=200`,
      { headers },
    );
    const recipes = await recipesRes.json() as { id: string, ingredientes_principales: string[] | null }[];
    const disjointRecipe = recipes.find(r =>
      (r.ingredientes_principales ?? []).length > 0
      && r.ingredientes_principales!.every(ingrediente => !enLista.has(normalizeNombre(ingrediente))));
    if (!disjointRecipe) {
      throw new Error('No se encontró ninguna receta del catálogo con ingredientes fuera de la lista generada — no se pudo sembrar el fixture.');
    }

    // Belt-and-braces: this is a brand-new factory user with no prior
    // favorites, but deleting first keeps this step correct even if that
    // ever stops being true (e.g. a future factory option pre-seeds one).
    await request.delete(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/favorites?user_id=eq.${userId}`, { headers });
    await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/favorites`, {
      headers,
      data: { user_id: userId, recipe_id: disjointRecipe.id },
    });

    await page.reload();
    await expect(page.getByTestId('shopping_list_suggestions_section')).toBeVisible();
  },
);

let addedSuggestionNombre = '';

When(/^pulsa "Añadir" en esa sugerencia$/, async ({ page }) => {
  // `shopping_list_add_suggestion_<nombre>` embeds the raw (uncapitalized)
  // ingredient name — captured before clicking so the Then step can assert
  // the SAME product landed in the real list, not just "something did".
  const button = page.getByTestId('shopping_list_suggestions_section').getByRole('button', { name: 'Añadir' }).first();
  const testId = await button.getAttribute('data-testid');
  addedSuggestionNombre = testId!.replace('shopping_list_add_suggestion_', '');
  await button.click();
});

Then(/^el producto aparece en la lista, en su pasillo correspondiente$/, async ({ page }) => {
  const capitalized = addedSuggestionNombre.charAt(0).toUpperCase() + addedSuggestionNombre.slice(1);
  // Outside the suggestions carousel — proves it landed in a real aisle
  // list item row, not just still sitting in the (about-to-shrink) card.
  await expect(page.locator('main').getByText(capitalized, { exact: true })).toBeVisible();
});

Then(/^la sugerencia desaparece del carrusel$/, async ({ page }) => {
  // Checks the ADDED suggestion specifically, not "the whole carousel is
  // gone" — the seeded favorite recipe can have up to 3
  // ingredientes_principales, each its own suggestion (MAX_SUGGESTIONS=3
  // truncates by ingredient, not by recipe), so adding one doesn't
  // necessarily empty the section if the recipe had others.
  await expect(page.getByTestId(`shopping_list_add_suggestion_${addedSuggestionNombre}`)).toHaveCount(0);
});

Then(/^el producto se conserva la próxima vez que abre la lista$/, async ({ page }) => {
  const capitalized = addedSuggestionNombre.charAt(0).toUpperCase() + addedSuggestionNombre.slice(1);
  await page.reload();
  await expect(page.locator('main').getByText(capitalized, { exact: true })).toBeVisible();
});

Then(/^el estado se conserva la próxima vez que abre la lista$/, async ({ page }) => {
  await page.reload();
  await expect(page.getByTestId('shopping_list_item_0_0')).toBeChecked();
});
