import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentUserId, getAccessToken, restHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @seguridad,
 * "Un usuario no puede leer el historial ni el perfil de otro pasando su
 * UUID" (FRESCO-27 fix — `get_filtered_recipes`/`get_recent_recipe_marks` are
 * `SECURITY DEFINER` and used to trust `p_user_id` blindly).
 * `get_recent_recipe_marks` replaced `get_recent_recipe_ids` in FRESCO-120
 * (migration `20260808010000`) — same `mp.user_id = auth.uid()` ownership
 * check, just a `returns table` shape now instead of a scalar array (see
 * the assertion below for what that changes).
 *
 * Pure REST, no browser, no Gemini call — cheap and fast by design. This is
 * the negative-test pattern for ownership bugs: assert directly against the
 * RPC, not through the UI, since the UI never had a path to trigger this in
 * the first place (it's an out-of-band REST call an attacker would make).
 */

const { Given, When, Then } = createBdd(test);

interface Ctx {
  accessTokenA: string
  userIdB: string
  recentIdsResult: unknown
  filteredResponse: { status: number, body: unknown }
}
const ctx: Ctx = {
  accessTokenA: '',
  userIdB: '',
  recentIdsResult: undefined,
  filteredResponse: { status: 0, body: undefined },
};

Given(
  /^que dos cuentas reales y distintas existen, cada una con su propio perfil e historial de comidas$/,
  async ({ request }) => {
    if (
      !process.env.LOCAL_USER_EMAIL || !process.env.LOCAL_USER_PASSWORD
      || !process.env.PRO_TEST_USER_EMAIL || !process.env.PRO_TEST_USER_PASSWORD
    ) {
      throw new Error('LOCAL_USER_* / PRO_TEST_USER_* must be set in .env for this scenario.');
    }

    ctx.accessTokenA = await getAccessToken(request, process.env.LOCAL_USER_EMAIL, process.env.LOCAL_USER_PASSWORD);
    const accessTokenB = await getAccessToken(request, process.env.PRO_TEST_USER_EMAIL, process.env.PRO_TEST_USER_PASSWORD);
    ctx.userIdB = await currentUserId(request, accessTokenB);
  },
);

When(/^una de las cuentas llama a get_recent_recipe_marks con el UUID de la otra$/, async ({ request }) => {
  const res = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_recent_recipe_marks`, {
    headers: restHeaders(ctx.accessTokenA),
    data: { p_user_id: ctx.userIdB, p_weeks: 2 },
  });
  ctx.recentIdsResult = await res.json();
});

Then(/^no recibe el historial real de la otra cuenta$/, () => {
  // The fix makes this a silent-empty result — `get_recent_recipe_marks`
  // is `returns table(...)`, so PostgREST serializes zero matching rows as
  // `[]`, not `null` (that was the OLD `get_recent_recipe_ids` scalar-array
  // shape, retired in FRESCO-120).
  expect(ctx.recentIdsResult).toEqual([]);
});

When(/^la misma cuenta llama a get_filtered_recipes con el UUID de la otra$/, async ({ request }) => {
  const res = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_filtered_recipes`, {
    headers: restHeaders(ctx.accessTokenA),
    data: { p_user_id: ctx.userIdB },
  });
  ctx.filteredResponse = { status: res.status(), body: await res.json() };
});

Then(/^la llamada es rechazada, no se filtra el catálogo con el perfil ajeno$/, () => {
  // This one raises (plpgsql `raise exception`), unlike the SQL-language
  // get_recent_recipe_ids above — different language, different feasible
  // fix shape, same real guarantee.
  expect(ctx.filteredResponse.status).toBe(400);
  expect(JSON.stringify(ctx.filteredResponse.body)).toContain('caller does not own profile');
});

// ── swap_meal_plan_slots — already had an auth.uid() ownership check before
// this session (unlike the two functions above), but it had never actually
// been proven by a test until now. ────────────────────────────────────────

interface SwapCtx {
  slotAId: string
  slotBId: string
  swapResponse: { status: number, body: unknown }
}
const swapCtx: SwapCtx = { slotAId: '', slotBId: '', swapResponse: { status: 0, body: undefined } };

Given(/^que otra cuenta real tiene un menú con dos franjas propias$/, async ({ request }) => {
  const accessTokenB = await getAccessToken(request, process.env.PRO_TEST_USER_EMAIL!, process.env.PRO_TEST_USER_PASSWORD!);
  const headersB = restHeaders(accessTokenB);
  const userIdB = await currentUserId(request, accessTokenB);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  await request.delete(`${url}/rest/v1/meal_plans?id=not.is.null`, { headers: headersB });

  const recipesRes = await request.get(`${url}/rest/v1/recipes?select=id&limit=1`, { headers: headersB });
  const [recipe] = await recipesRes.json() as { id: string }[];

  const planRes = await request.post(`${url}/rest/v1/meal_plans`, {
    headers: { ...headersB, Prefer: 'return=representation' },
    data: { user_id: userIdB, semana_iso: '2026-W99', fecha_inicio: '2026-12-14', advertencias: [] },
  });
  const [plan] = await planRes.json() as { id: string }[];

  const slotsRes = await request.post(`${url}/rest/v1/meal_plan_recipes`, {
    headers: { ...headersB, Prefer: 'return=representation' },
    data: [
      { meal_plan_id: plan.id, recipe_id: recipe.id, dia: 'lunes', tipo_plato: 'desayuno' },
      { meal_plan_id: plan.id, recipe_id: recipe.id, dia: 'martes', tipo_plato: 'desayuno' },
    ],
  });
  const [slotA, slotB] = await slotsRes.json() as { id: string }[];
  swapCtx.slotAId = slotA.id;
  swapCtx.slotBId = slotB.id;
});

When(/^intento intercambiar esas dos franjas ajenas desde mi propia sesión$/, async ({ request }) => {
  const accessTokenA = await getAccessToken(request, process.env.LOCAL_USER_EMAIL!, process.env.LOCAL_USER_PASSWORD!);
  const res = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/swap_meal_plan_slots`, {
    headers: restHeaders(accessTokenA),
    data: { p_slot_a_id: swapCtx.slotAId, p_slot_b_id: swapCtx.slotBId },
  });
  swapCtx.swapResponse = { status: res.status(), body: await res.json() };
});

Then(/^la llamada es rechazada por no ser el dueño del plan$/, () => {
  expect(swapCtx.swapResponse.status).toBe(400);
  expect(JSON.stringify(swapCtx.swapResponse.body)).toContain('caller does not own meal plan');
});

// ── jsonb_set_comprado — also already had an auth.uid() check, same
// never-proven-by-a-test gap. Note this one FAILS SILENTLY (204, no error)
// rather than raising — the real assertion has to be "the other account's
// data didn't change", not just the HTTP status. ───────────────────────────

interface ComprarCtx {
  listId: string
  setComprado: { status: number }
}
const comprarCtx: ComprarCtx = { listId: '', setComprado: { status: 0 } };

Given(/^que otra cuenta real tiene una lista de la compra con un ítem sin comprar$/, async ({ request }) => {
  const accessTokenB = await getAccessToken(request, process.env.PRO_TEST_USER_EMAIL!, process.env.PRO_TEST_USER_PASSWORD!);
  const headersB = restHeaders(accessTokenB);
  const userIdB = await currentUserId(request, accessTokenB);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  await request.delete(`${url}/rest/v1/meal_plans?id=not.is.null`, { headers: headersB });

  const planRes = await request.post(`${url}/rest/v1/meal_plans`, {
    headers: { ...headersB, Prefer: 'return=representation' },
    data: { user_id: userIdB, semana_iso: '2026-W99', fecha_inicio: '2026-12-14', advertencias: [] },
  });
  const [plan] = await planRes.json() as { id: string }[];

  const listRes = await request.post(`${url}/rest/v1/shopping_lists`, {
    headers: { ...headersB, Prefer: 'return=representation' },
    data: {
      user_id: userIdB,
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
  const accessTokenA = await getAccessToken(request, process.env.LOCAL_USER_EMAIL!, process.env.LOCAL_USER_PASSWORD!);
  const res = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/jsonb_set_comprado`, {
    headers: restHeaders(accessTokenA),
    data: { p_list_id: comprarCtx.listId, p_pasillo_idx: 0, p_item_idx: 0, p_comprado: true },
  });
  comprarCtx.setComprado = { status: res.status() };
});

Then(/^la llamada no da error pero el ítem de la otra cuenta sigue sin comprar$/, async ({ request }) => {
  expect(comprarCtx.setComprado.status).toBe(204);

  const accessTokenB = await getAccessToken(request, process.env.PRO_TEST_USER_EMAIL!, process.env.PRO_TEST_USER_PASSWORD!);
  const res = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/shopping_lists?id=eq.${comprarCtx.listId}&select=items`,
    { headers: restHeaders(accessTokenB) },
  );
  const [row] = await res.json() as { items: { items: { comprado: boolean }[] }[] }[];
  expect(row.items[0].items[0].comprado).toBe(false);
});
