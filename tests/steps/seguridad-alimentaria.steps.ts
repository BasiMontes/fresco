import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentWeekMonday, restHeaders, serviceRoleHeaders } from '../test-helpers';
import { generateCurrentWeekPlan, seedFullWeekMenu } from '../test-user-factory';

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

// ── FRESCO-362 helpers ────────────────────────────────────────────────────

const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
// PostgREST `cs` (jsonb contains) filter for a recipe carrying "gluten", and
// its negation for one that does not.
const CONTAINS_GLUTEN = 'alergenos=cs.%5B%22gluten%22%5D';
const NOT_CONTAINS_GLUTEN = 'alergenos=not.cs.%5B%22gluten%22%5D';

async function firstRecipeId(request: APIRequestContext, user: TestUser, filter: string): Promise<string> {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/recipes?select=id&${filter}&limit=1`, {
    headers: restHeaders(user.accessToken),
  });
  const [recipe] = await res.json() as { id: string }[];
  if (!recipe) { throw new Error(`[seguridad-alimentaria] no catalog recipe for filter: ${filter}`); }
  return recipe.id;
}

// ── Scenario 4: substitution rejects an allergen recipe (A4-H1) ────────────

interface SubCtx {
  user: TestUser | null
  slotId: string
  originalRecipeId: string
  glutenRecipeId: string
  response: APIResponse | null
}
const subCtx: SubCtx = { user: null, slotId: '', originalRecipeId: '', glutenRecipeId: '', response: null };

Given(/^que un perfil declara alergia a "gluten" y tiene un menú sembrado$/, async ({ testUserFactory, request }) => {
  subCtx.user = await testUserFactory();
  await setProfileAllergens(request, subCtx.user.id, ['gluten']);
  await seedFullWeekMenu(request, subCtx.user);

  const headers = restHeaders(subCtx.user.accessToken);
  const planRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plans?select=id&user_id=eq.${subCtx.user.id}&limit=1`,
    { headers },
  );
  const [plan] = await planRes.json() as { id: string }[];
  const slotRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plan_recipes?select=id,recipe_id&meal_plan_id=eq.${plan.id}&limit=1`,
    { headers },
  );
  const [slot] = await slotRes.json() as { id: string, recipe_id: string }[];
  subCtx.slotId = slot.id;
  subCtx.originalRecipeId = slot.recipe_id;
  subCtx.glutenRecipeId = await firstRecipeId(request, subCtx.user, CONTAINS_GLUTEN);
});

When(/^intenta sustituir un plato por una receta que contiene "gluten"$/, async ({ request }) => {
  subCtx.response = await request.post(`${FUNCTIONS_URL}/update-recipe-status`, {
    headers: restHeaders(subCtx.user!.accessToken),
    data: { meal_plan_recipe_id: subCtx.slotId, estado: 'sustituida', nueva_recipe_id: subCtx.glutenRecipeId },
  });
});

Then(/^la petición se rechaza con 422 y el plato no cambia$/, async ({ request }) => {
  expect(subCtx.response!.status()).toBe(422);
  const res = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plan_recipes?select=recipe_id,estado&id=eq.${subCtx.slotId}`,
    { headers: restHeaders(subCtx.user!.accessToken) },
  );
  const [row] = await res.json() as { recipe_id: string, estado: string }[];
  expect(row.recipe_id).toBe(subCtx.originalRecipeId);
  expect(row.estado).toBe('pendiente');
});

// ── Scenario 5: estado whitelist (A4-L7) ──────────────────────────────────

const whitelistCtx: { user: TestUser | null, response: APIResponse | null } = { user: null, response: null };

Given(/^que un usuario autenticado sin menú$/, async ({ testUserFactory }) => {
  whitelistCtx.user = await testUserFactory();
});

When(/^envía un estado que no es "cocinada", "descartada" ni "sustituida"$/, async ({ request }) => {
  whitelistCtx.response = await request.post(`${FUNCTIONS_URL}/update-recipe-status`, {
    headers: restHeaders(whitelistCtx.user!.accessToken),
    // `pendiente` is a real enum value but system-assigned only — the
    // whitelist must reject it, not defer to the DB enum.
    data: { meal_plan_recipe_id: crypto.randomUUID(), estado: 'pendiente' },
  });
});

Then(/^la petición se rechaza con 400$/, () => {
  expect(whitelistCtx.response!.status()).toBe(400);
});

// ── Scenario 6: reassignment re-filters against the target (A4-H2) ─────────

interface ReassignCtx {
  from: TestUser | null
  to: TestUser | null
  glutenSlotId: string
  cleanSlotId: string
  cleanRecipeId: string
}
const reassignCtx: ReassignCtx = { from: null, to: null, glutenSlotId: '', cleanSlotId: '', cleanRecipeId: '' };

Given(/^que la cuenta destino declara alergia a "gluten"$/, async ({ testUserFactory, request }) => {
  reassignCtx.to = await testUserFactory();
  await setProfileAllergens(request, reassignCtx.to.id, ['gluten']);
});

Given(/^una invitada tiene un menú con una receta que contiene "gluten" y otra que no$/, async ({ testUserFactory, request }) => {
  reassignCtx.from = await testUserFactory();
  const headers = restHeaders(reassignCtx.from.accessToken);

  const glutenRecipeId = await firstRecipeId(request, reassignCtx.from, CONTAINS_GLUTEN);
  reassignCtx.cleanRecipeId = await firstRecipeId(request, reassignCtx.from, NOT_CONTAINS_GLUTEN);

  const { semanaIso, fechaInicio } = currentWeekMonday();
  const planRes = await request.post(`${SUPABASE_URL}/rest/v1/meal_plans`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: { user_id: reassignCtx.from.id, semana_iso: semanaIso, fecha_inicio: fechaInicio, advertencias: [] },
  });
  if (!planRes.ok()) { throw new Error(`[seguridad-alimentaria] seed plan failed: ${planRes.status()} ${await planRes.text()}`); }
  const [plan] = await planRes.json() as { id: string }[];

  const slotsRes = await request.post(`${SUPABASE_URL}/rest/v1/meal_plan_recipes`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: [
      { meal_plan_id: plan.id, recipe_id: glutenRecipeId, dia: 'lunes', tipo_plato: 'comida' },
      { meal_plan_id: plan.id, recipe_id: reassignCtx.cleanRecipeId, dia: 'lunes', tipo_plato: 'cena' },
    ],
  });
  if (!slotsRes.ok()) { throw new Error(`[seguridad-alimentaria] seed slots failed: ${slotsRes.status()} ${await slotsRes.text()}`); }
  const slots = await slotsRes.json() as { id: string, tipo_plato: string }[];
  reassignCtx.glutenSlotId = slots.find(s => s.tipo_plato === 'comida')!.id;
  reassignCtx.cleanSlotId = slots.find(s => s.tipo_plato === 'cena')!.id;
});

When(/^se reasignan los datos de la invitada a la cuenta destino$/, async ({ request }) => {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/reassign_guest_data`, {
    headers: serviceRoleHeaders(),
    data: { p_from_user_id: reassignCtx.from!.id, p_to_user_id: reassignCtx.to!.id },
  });
  if (!res.ok()) { throw new Error(`[seguridad-alimentaria] reassign_guest_data failed: ${res.status()} ${await res.text()}`); }
});

Then(/^el plato con "gluten" queda excluido y el plato sin alérgeno se conserva$/, async ({ request }) => {
  const headers = restHeaders(reassignCtx.to!.accessToken);

  const gRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plan_recipes?select=estado,recipe_id&id=eq.${reassignCtx.glutenSlotId}`,
    { headers },
  );
  const [gRow] = await gRes.json() as { estado: string, recipe_id: string | null }[];
  expect(gRow.estado).toBe('excluida');
  expect(gRow.recipe_id).toBeNull();

  const cRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plan_recipes?select=estado,recipe_id&id=eq.${reassignCtx.cleanSlotId}`,
    { headers },
  );
  const [cRow] = await cRes.json() as { estado: string, recipe_id: string | null }[];
  expect(cRow.recipe_id).toBe(reassignCtx.cleanRecipeId);
});
