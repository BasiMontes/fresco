import type { APIRequestContext } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { isoWeekOf, mondayOfWeekContaining, restHeaders, serviceRoleHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @aprendizaje,
 * "La generación pesa el historial real de un usuario Pro y produce una
 * explicación (FR-5.4/5.5)".
 *
 * FRESCO-353 (2nd batch of the FRESCO-321 ratchet). This is the moat: the
 * deterministic selector (ADR-0005/ADR-0006) reads a Pro user's real
 * cooked/discarded history, avoids repeating those recipes, and produces a
 * `explicacion_aprendizaje` string kept separate from `advertencias`.
 * `aprendizaje-pro.steps.ts` only checks the card renders — this checks the
 * generation output itself.
 */

const { Given, When, Then } = createBdd(test);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIPOS = ['desayuno', 'comida', 'cena'] as const;

interface Ctx {
  testUser: TestUser | null
  cookedRecipeIds: string[]
  discardedRecipeIds: string[]
  boostRecipeId: string
  nextWeekIso: string
  plan: { explicacion_aprendizaje: string | null, advertencias: unknown[] } | null
  planRecipeIds: string[]
}
const ctx: Ctx = { testUser: null, cookedRecipeIds: [], discardedRecipeIds: [], boostRecipeId: '', nextWeekIso: '', plan: null, planRecipeIds: [] };

function weekIso(weekOffset: number): { semanaIso: string, fechaInicio: string } {
  const monday = mondayOfWeekContaining(new Date());
  monday.setUTCDate(monday.getUTCDate() + weekOffset * 7);
  return { semanaIso: isoWeekOf(monday), fechaInicio: monday.toISOString().slice(0, 10) };
}

async function seedWeek(
  request: APIRequestContext,
  testUser: TestUser,
  weekOffset: number,
  recipeIds: string[],
  estado: 'cocinada' | 'descartada',
): Promise<void> {
  const { semanaIso, fechaInicio } = weekIso(weekOffset);
  // FRESCO-777: authenticated cannot INSERT meal_plans / meal_plan_recipes any
  // more (only generate-meal-plan writes them); fixtures seed as service role.
  const planRes = await request.post(`${SUPABASE_URL}/rest/v1/meal_plans`, {
    headers: { ...serviceRoleHeaders(), Prefer: 'return=representation' },
    data: { user_id: testUser.id, semana_iso: semanaIso, fecha_inicio: fechaInicio, advertencias: [] },
  });
  const [plan] = await planRes.json() as { id: string }[];
  const slots = DIAS.flatMap((dia, d) => TIPOS.map(tipo => ({
    meal_plan_id: plan.id,
    recipe_id: recipeIds[d % recipeIds.length],
    dia,
    tipo_plato: tipo,
    estado,
  })));
  const res = await request.post(`${SUPABASE_URL}/rest/v1/meal_plan_recipes`, { headers: serviceRoleHeaders(), data: slots });
  if (!res.ok()) { throw new Error(`seedWeek failed: ${res.status()} ${await res.text()}`); }
}

/**
 * Seeds one recipe cooked `count` times in a single OLD plan (far outside
 * `get_recent_recipe_marks`'s 14-day window, so it is NOT excluded from next
 * week) — `get_user_recipe_engagement` is all-time, so this drives
 * `veces_cocinada_usuario = count` and the `+min(count, 5) * 1.0` boost in
 * `scoreRecipe` (ADR-0008). FRESCO-387 / A4-M15.
 */
async function seedCookedManyTimes(
  request: APIRequestContext,
  testUser: TestUser,
  weekOffset: number,
  recipeId: string,
  count: number,
): Promise<void> {
  const { semanaIso, fechaInicio } = weekIso(weekOffset);
  // FRESCO-777: authenticated cannot INSERT meal_plans / meal_plan_recipes any
  // more (only generate-meal-plan writes them); fixtures seed as service role.
  const planRes = await request.post(`${SUPABASE_URL}/rest/v1/meal_plans`, {
    headers: { ...serviceRoleHeaders(), Prefer: 'return=representation' },
    data: { user_id: testUser.id, semana_iso: semanaIso, fecha_inicio: fechaInicio, advertencias: [] },
  });
  const [plan] = await planRes.json() as { id: string }[];
  const pairs = DIAS.flatMap(dia => TIPOS.map(tipo => ({ dia, tipo }))).slice(0, count);
  const slots = pairs.map(({ dia, tipo }) => ({
    meal_plan_id: plan.id,
    recipe_id: recipeId,
    dia,
    tipo_plato: tipo,
    estado: 'cocinada' as const,
  }));
  const res = await request.post(`${SUPABASE_URL}/rest/v1/meal_plan_recipes`, { headers: serviceRoleHeaders(), data: slots });
  if (!res.ok()) { throw new Error(`seedCookedManyTimes failed: ${res.status()} ${await res.text()}`); }
}

Given(/^que un usuario Pro tiene al menos 2 semanas de historial cocinado\/descartado real$/, async ({ request, testUserFactory }) => {
  test.setTimeout(60_000);
  const testUser = await testUserFactory({ plan: 'pro' });
  ctx.testUser = testUser;
  const headers = restHeaders(testUser.accessToken);

  const recipesRes = await request.get(`${SUPABASE_URL}/rest/v1/recipes?select=id&limit=15`, { headers });
  const ids = (await recipesRes.json() as { id: string }[]).map(r => r.id);
  ctx.cookedRecipeIds = ids.slice(0, 7);
  ctx.discardedRecipeIds = ids.slice(7, 14);
  ctx.boostRecipeId = ids[14];

  // Both RECENT history weeks must land inside `get_recent_recipe_marks`'s
  // window (`fecha_inicio >= current_date - 14`, ADR-0006). Week -2's Monday is
  // up to 20 days before `current_date`, so it only qualified when the suite
  // ran on a Monday — this scenario silently went red every other weekday.
  // Seeding the current week + last week keeps two distinct weeks of history,
  // both always within the 14-day lookback.
  await seedWeek(request, testUser, 0, ctx.cookedRecipeIds, 'cocinada');
  await seedWeek(request, testUser, -1, ctx.discardedRecipeIds, 'descartada');

  // A4-M15: one recipe cooked repeatedly ~6 weeks ago — outside the recency
  // window (so NOT excluded), but a strong all-time personal signal (+5.0 in
  // scoreRecipe). Next week's plan should surface it.
  await seedCookedManyTimes(request, testUser, -6, ctx.boostRecipeId, 5);
});

When(/^se genera su menú de la semana siguiente$/, async ({ request }) => {
  const testUser = ctx.testUser!;
  const headers = restHeaders(testUser.accessToken);
  const { semanaIso, fechaInicio } = weekIso(1);
  ctx.nextWeekIso = semanaIso;

  const genRes = await request.post(`${SUPABASE_URL}/functions/v1/generate-meal-plan`, {
    headers,
    data: { semana_iso: semanaIso, fecha_inicio: fechaInicio },
    timeout: 120_000,
  });
  if (!genRes.ok()) { throw new Error(`generate-meal-plan failed: ${genRes.status()} ${await genRes.text()}`); }

  const planRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plans?select=id,explicacion_aprendizaje,advertencias&user_id=eq.${testUser.id}&semana_iso=eq.${semanaIso}`,
    { headers },
  );
  const [plan] = await planRes.json() as { id: string, explicacion_aprendizaje: string | null, advertencias: unknown[] }[];
  ctx.plan = plan;

  const slotsRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plan_recipes?select=recipe_id&meal_plan_id=eq.${plan.id}`,
    { headers },
  );
  ctx.planRecipeIds = (await slotsRes.json() as { recipe_id: string | null }[])
    .map(r => r.recipe_id)
    .filter((id): id is string => id !== null);
});

Then(/^el algoritmo determinista evita repetir recetas marcadas cocinada o descartada, sin tocar las pendientes$/, async () => {
  // A4-M15: assert BOTH halves — the step only checked discarded before.
  const repeatedDiscarded = ctx.planRecipeIds.filter(id => ctx.discardedRecipeIds.includes(id));
  const repeatedCooked = ctx.planRecipeIds.filter(id => ctx.cookedRecipeIds.includes(id));
  expect({ repeatedDiscarded, repeatedCooked }).toEqual({ repeatedDiscarded: [], repeatedCooked: [] });
});

Then(/^el historial personal de esa receta cuenta como señal de preferencia y no queda excluida por recencia$/, async ({ request }) => {
  // A4-M15: assert the mechanism the ADR-0008 boost rides on, deterministically —
  // NOT the stochastic "does it land a slot" outcome (that depends on category
  // buckets, diversity penalties and which tipo_plato the recipe happens to be).
  const headers = restHeaders(ctx.testUser!.accessToken);

  // 1. get_user_recipe_engagement (all-time) counts every cooked mark → +N boost in scoreRecipe.
  const engRes = await request.post(`${SUPABASE_URL}/rest/v1/rpc/get_user_recipe_engagement`, {
    headers,
    data: { p_user_id: ctx.testUser!.id },
  });
  const engagement = await engRes.json() as { recipe_id: string, veces_cocinada_usuario: number }[];
  const boostRow = engagement.find(r => r.recipe_id === ctx.boostRecipeId);
  expect(boostRow?.veces_cocinada_usuario).toBe(5);

  // 2. get_recent_recipe_marks (last 2 weeks) must NOT list it — a >14-day-old
  //    cooked recipe is a preference signal, not an exclusion.
  const recentRes = await request.post(`${SUPABASE_URL}/rest/v1/rpc/get_recent_recipe_marks`, {
    headers,
    data: { p_user_id: ctx.testUser!.id, p_weeks: 2 },
  });
  const recent = await recentRes.json() as { recipe_id: string }[];
  expect(recent.map(r => r.recipe_id)).not.toContain(ctx.boostRecipeId);
});

Then(/^genera una explicación cálida en "explicacion_aprendizaje", separada de "advertencias", que menciona cocinadas y descartadas por separado$/, async () => {
  const explicacion = ctx.plan?.explicacion_aprendizaje ?? '';
  expect(explicacion.length).toBeGreaterThan(0);
  expect(explicacion.toLowerCase()).toMatch(/cocina/);
  expect(explicacion.toLowerCase()).toMatch(/descart/);
});

Then(/^queda persistida en su propio campo, no mezclada con las advertencias de seguridad$/, async () => {
  const advertenciasText = JSON.stringify(ctx.plan?.advertencias ?? []);
  expect(advertenciasText).not.toContain(ctx.plan?.explicacion_aprendizaje ?? ' never');
});
