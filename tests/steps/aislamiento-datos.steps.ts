import type { APIRequestContext } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { restHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @seguridad,
 * cross-account isolation: an attacker account (A) must not be able to read
 * or mutate a victim account (B)'s data by passing B's UUID to a
 * `SECURITY DEFINER` RPC (FRESCO-27 / FRESCO-120 fixes).
 *
 * FRESCO-356: migrated off the shared `DEV_USER` / `PRO_USER` pair. Each
 * scenario provisions its own two throwaway factory users (FRESCO-308) — A
 * the caller, B the target — so nothing is shared between scenarios and the
 * suite runs in parallel. Pure REST, no browser, no Gemini.
 */

const { Given, When, Then } = createBdd(test);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// ── get_recent_recipe_marks / get_filtered_recipes ──────────────────────────

interface Ctx {
  userA: TestUser | null
  userB: TestUser | null
  recentIdsResult: unknown
  filteredResponse: { status: number, body: unknown }
}
const ctx: Ctx = { userA: null, userB: null, recentIdsResult: undefined, filteredResponse: { status: 0, body: undefined } };

Given(
  /^que dos cuentas reales y distintas existen, cada una con su propio perfil e historial de comidas$/,
  async ({ testUserFactory }) => {
    ctx.userA = await testUserFactory();
    ctx.userB = await testUserFactory();
  },
);

When(/^una de las cuentas llama a get_recent_recipe_marks con el UUID de la otra$/, async ({ request }) => {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/get_recent_recipe_marks`, {
    headers: restHeaders(ctx.userA!.accessToken),
    data: { p_user_id: ctx.userB!.id, p_weeks: 2 },
  });
  ctx.recentIdsResult = await res.json();
});

Then(/^no recibe el historial real de la otra cuenta$/, () => {
  expect(ctx.recentIdsResult).toEqual([]);
});

When(/^la misma cuenta llama a get_filtered_recipes con el UUID de la otra$/, async ({ request }) => {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/get_filtered_recipes`, {
    headers: restHeaders(ctx.userA!.accessToken),
    data: { p_user_id: ctx.userB!.id },
  });
  ctx.filteredResponse = { status: res.status(), body: await res.json() };
});

Then(/^la llamada es rechazada, no se filtra el catálogo con el perfil ajeno$/, () => {
  expect(ctx.filteredResponse.status).toBe(400);
  expect(JSON.stringify(ctx.filteredResponse.body)).toContain('caller does not own profile');
});

// ── swap_meal_plan_slots ──────────────────────────────────────────────────

interface SwapCtx {
  userA: TestUser | null
  slotAId: string
  slotBId: string
  swapResponse: { status: number, body: unknown }
}
const swapCtx: SwapCtx = { userA: null, slotAId: '', slotBId: '', swapResponse: { status: 0, body: undefined } };

async function seedVictimPlan(request: APIRequestContext, victim: TestUser): Promise<{ id: string }[]> {
  const headers = restHeaders(victim.accessToken);
  const recipesRes = await request.get(`${SUPABASE_URL}/rest/v1/recipes?select=id&limit=1`, { headers });
  const [recipe] = await recipesRes.json() as { id: string }[];
  const planRes = await request.post(`${SUPABASE_URL}/rest/v1/meal_plans`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: { user_id: victim.id, semana_iso: '2026-W99', fecha_inicio: '2026-12-14', advertencias: [] },
  });
  const [plan] = await planRes.json() as { id: string }[];
  const slotsRes = await request.post(`${SUPABASE_URL}/rest/v1/meal_plan_recipes`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: [
      { meal_plan_id: plan.id, recipe_id: recipe.id, dia: 'lunes', tipo_plato: 'desayuno' },
      { meal_plan_id: plan.id, recipe_id: recipe.id, dia: 'martes', tipo_plato: 'desayuno' },
    ],
  });
  return await slotsRes.json() as { id: string }[];
}

Given(/^que otra cuenta real tiene un menú con dos franjas propias$/, async ({ request, testUserFactory }) => {
  swapCtx.userA = await testUserFactory();
  const victim = await testUserFactory();
  const [slotA, slotB] = await seedVictimPlan(request, victim);
  swapCtx.slotAId = slotA.id;
  swapCtx.slotBId = slotB.id;
});

When(/^intento intercambiar esas dos franjas ajenas desde mi propia sesión$/, async ({ request }) => {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/swap_meal_plan_slots`, {
    headers: restHeaders(swapCtx.userA!.accessToken),
    data: { p_slot_a_id: swapCtx.slotAId, p_slot_b_id: swapCtx.slotBId },
  });
  swapCtx.swapResponse = { status: res.status(), body: await res.json() };
});

Then(/^la llamada es rechazada por no ser el dueño del plan$/, () => {
  expect(swapCtx.swapResponse.status).toBe(400);
  expect(JSON.stringify(swapCtx.swapResponse.body)).toContain('caller does not own meal plan');
});

// ── jsonb_set_comprado (fails silently — assert the data, not the status) ──

interface ComprarCtx {
  userA: TestUser | null
  victim: TestUser | null
  listId: string
  setComprado: { status: number }
}
const comprarCtx: ComprarCtx = { userA: null, victim: null, listId: '', setComprado: { status: 0 } };

Given(/^que otra cuenta real tiene una lista de la compra con un ítem sin comprar$/, async ({ request, testUserFactory }) => {
  comprarCtx.userA = await testUserFactory();
  const victim = await testUserFactory();
  comprarCtx.victim = victim;
  const headers = restHeaders(victim.accessToken);

  const planRes = await request.post(`${SUPABASE_URL}/rest/v1/meal_plans`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: { user_id: victim.id, semana_iso: '2026-W99', fecha_inicio: '2026-12-14', advertencias: [] },
  });
  const [plan] = await planRes.json() as { id: string }[];

  const listRes = await request.post(`${SUPABASE_URL}/rest/v1/shopping_lists`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: {
      user_id: victim.id,
      meal_plan_id: plan.id,
      items: [{ nombre: 'Frutas y verduras', orden: 1, items: [{ nombre: 'cebolla', cantidad: 1, unidad: 'unidades', comprado: false }] }],
      coste_estimado_min: 0,
      coste_estimado_max: 0,
    },
  });
  const [list] = await listRes.json() as { id: string }[];
  comprarCtx.listId = list.id;
});

When(/^intento marcar ese ítem ajeno como comprado desde mi propia sesión$/, async ({ request }) => {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/jsonb_set_comprado`, {
    headers: restHeaders(comprarCtx.userA!.accessToken),
    data: { p_list_id: comprarCtx.listId, p_pasillo_idx: 0, p_item_idx: 0, p_comprado: true },
  });
  comprarCtx.setComprado = { status: res.status() };
});

Then(/^la llamada no da error pero el ítem de la otra cuenta sigue sin comprar$/, async ({ request }) => {
  expect(comprarCtx.setComprado.status).toBe(204);
  const res = await request.get(
    `${SUPABASE_URL}/rest/v1/shopping_lists?id=eq.${comprarCtx.listId}&select=items`,
    { headers: restHeaders(comprarCtx.victim!.accessToken) },
  );
  const [row] = await res.json() as { items: { items: { comprado: boolean }[] }[] }[];
  expect(row.items[0].items[0].comprado).toBe(false);
});
