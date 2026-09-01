import type { APIRequestContext } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { restHeaders, serviceRoleHeaders } from '../test-helpers';
import { generateCurrentWeekPlan } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @seguridad-alimentaria,
 * FRESCO-361 (audit-4 A4-B2). `get_filtered_recipes()` is the only structural
 * food-safety enforcement point, and until this ticket nothing traced a
 * declared allergen from the profile all the way to the plate.
 *
 * Pure REST + the real `generate-meal-plan` edge function. No browser.
 */

const { Given, When, Then } = createBdd(test);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// The full canonical vocabulary (mirrors ALERGENO_OPTIONS / the CHECK constraint).
const DECLARABLE_ALLERGENS = [
  'apio',
  'cacahuetes',
  'crustaceos',
  'frutos_de_cascara',
  'gluten',
  'huevo',
  'lactosa',
  'moluscos',
  'pescado',
  'sesamo',
  'soja',
  'sulfitos',
] as const;

async function setProfileAllergens(request: APIRequestContext, userId: string, allergens: string[]): Promise<void> {
  // Service-role PATCH: `user_profiles.alergenos` has no column-write trigger,
  // and this bypasses the client-side ALERGENO_VALUES validation so the
  // uppercase case-insensitivity scenario can seed 'GLUTEN'.
  const res = await request.patch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
    headers: { ...serviceRoleHeaders(), Prefer: 'return=minimal' },
    data: { alergenos: allergens },
  });
  if (!res.ok()) { throw new Error(`[seguridad-alimentaria] failed to set alergenos: ${res.status()} ${await res.text()}`); }
}

async function filteredCatalog(request: APIRequestContext, user: TestUser): Promise<{ id: string, alergenos: string[] | null }[]> {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/get_filtered_recipes`, {
    headers: restHeaders(user.accessToken),
    data: { p_user_id: user.id },
  });
  if (!res.ok()) { throw new Error(`[seguridad-alimentaria] get_filtered_recipes failed: ${res.status()} ${await res.text()}`); }
  return await res.json() as { id: string, alergenos: string[] | null }[];
}

function lowerAll(values: string[] | null | undefined): string[] {
  return (values ?? []).map(v => v.toLowerCase());
}

// ── Scenario 1: allergen never reaches the generated menu ──────────────────

interface GenCtx {
  user: TestUser | null
  menuAllergens: string[]
}
const genCtx: GenCtx = { user: null, menuAllergens: [] };

Given(/^que un perfil declara alergia a "gluten" y "lactosa"$/, async ({ testUserFactory, request }) => {
  genCtx.user = await testUserFactory();
  await setProfileAllergens(request, genCtx.user.id, ['gluten', 'lactosa']);
});

When(/^se genera su menú semanal completo$/, async ({ request }) => {
  test.setTimeout(150_000);
  await generateCurrentWeekPlan(request, genCtx.user!);

  const headers = restHeaders(genCtx.user!.accessToken);
  const planRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plans?select=id&user_id=eq.${genCtx.user!.id}&order=created_at.desc&limit=1`,
    { headers },
  );
  const [plan] = await planRes.json() as { id: string }[];

  const slotsRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plan_recipes?select=recipe_id&meal_plan_id=eq.${plan.id}`,
    { headers },
  );
  const recipeIds = (await slotsRes.json() as { recipe_id: string | null }[])
    .map(r => r.recipe_id)
    .filter((id): id is string => id !== null);

  const recipesRes = await request.get(
    `${SUPABASE_URL}/rest/v1/recipes?select=alergenos&id=in.(${recipeIds.join(',')})`,
    { headers },
  );
  const recipes = await recipesRes.json() as { alergenos: string[] | null }[];
  genCtx.menuAllergens = recipes.flatMap(r => lowerAll(r.alergenos));
});

Then(/^ninguna de las 21 recetas del menú contiene "gluten" ni "lactosa"$/, () => {
  expect(genCtx.menuAllergens).not.toContain('gluten');
  expect(genCtx.menuAllergens).not.toContain('lactosa');
});

// ── Scenario 2: case-insensitive ──────────────────────────────────────────

interface CaseCtx {
  user: TestUser | null
  catalog: { id: string, alergenos: string[] | null }[]
}
const caseCtx: CaseCtx = { user: null, catalog: [] };

Given(/^que un perfil declara su alergia como "GLUTEN" en mayúsculas$/, async ({ testUserFactory, request }) => {
  caseCtx.user = await testUserFactory();
  await setProfileAllergens(request, caseCtx.user.id, ['GLUTEN']);
});

When(/^se pide su catálogo filtrado de recetas$/, async ({ request }) => {
  caseCtx.catalog = await filteredCatalog(request, caseCtx.user!);
});

Then(/^ninguna receta del catálogo filtrado contiene el alérgeno "gluten"$/, () => {
  expect(caseCtx.catalog.length).toBeGreaterThan(0);
  const leaked = caseCtx.catalog.filter(r => lowerAll(r.alergenos).includes('gluten'));
  expect(leaked).toEqual([]);
});

// ── Scenario 3: every declarable allergen actually filters ─────────────────

interface AllCtx {
  user: TestUser | null
  results: { allergen: string, leaked: number, excluded: number }[]
}
const allCtx: AllCtx = { user: null, results: [] };

Given(/^que el catálogo etiqueta recetas con cada alérgeno declarable$/, async ({ testUserFactory }) => {
  allCtx.user = await testUserFactory();
});

When(/^un perfil declara alergia a cada uno de ellos por separado$/, async ({ request }) => {
  const baseline = await filteredCatalog(request, allCtx.user!);
  const baselineCount = baseline.length;

  for (const allergen of DECLARABLE_ALLERGENS) {
    await setProfileAllergens(request, allCtx.user!.id, [allergen]);
    const catalog = await filteredCatalog(request, allCtx.user!);
    allCtx.results.push({
      allergen,
      leaked: catalog.filter(r => lowerAll(r.alergenos).includes(allergen)).length,
      excluded: baselineCount - catalog.length,
    });
  }
});

Then(/^el catálogo filtrado excluye toda receta que contenga ese alérgeno$/, () => {
  for (const result of allCtx.results) {
    expect(result.leaked, `${result.allergen} leaked into the filtered catalog`).toBe(0);
    expect(result.excluded, `${result.allergen} excluded nothing — is it tagged in the catalog at all?`).toBeGreaterThan(0);
  }
});
