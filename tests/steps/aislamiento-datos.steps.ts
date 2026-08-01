import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentUserId, getAccessToken, restHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @seguridad,
 * "Un usuario no puede leer el historial ni el perfil de otro pasando su
 * UUID" (FRESCO-27 fix — `get_filtered_recipes`/`get_recent_recipe_ids` are
 * `SECURITY DEFINER` and used to trust `p_user_id` blindly).
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

When(/^una de las cuentas llama a get_recent_recipe_ids con el UUID de la otra$/, async ({ request }) => {
  const res = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_recent_recipe_ids`, {
    headers: restHeaders(ctx.accessTokenA),
    data: { p_user_id: ctx.userIdB, p_weeks: 2 },
  });
  ctx.recentIdsResult = await res.json();
});

Then(/^no recibe el historial real de la otra cuenta$/, () => {
  // The fix makes this a silent-empty result (`null`), not the other
  // account's real recipe ids — matches get_recent_recipe_ids' own
  // pure-SQL shape (an added WHERE condition, not a raised exception).
  expect(ctx.recentIdsResult).toBeNull();
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
