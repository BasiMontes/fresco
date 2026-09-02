import type {
  GenerateMealPlanRequest,
  GenerateMealPlanResponse,
  ReassignGuestDataRequest,
  ReassignGuestDataResponse,
} from '@schemas';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  EdgeFunctionError,
  generateMealPlan,
  generateShoppingList,
  reassignGuestData,
  updateRecipeStatus,
} from './edge-functions';

const FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL;

const originalFetch = globalThis.fetch;

/** Captures the single most recent `fetch()` call this test issued. */
let lastFetchCall: { url: string, init: RequestInit } | undefined;

function stubFetch(response: { status: number, ok: boolean, body: unknown }) {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    lastFetchCall = { url: String(url), init: init ?? {} };
    return {
      ok: response.ok,
      status: response.status,
      statusText: 'stubbed',
      json: async () => response.body,
    } as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  lastFetchCall = undefined;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * bun-types' `.rejects.toThrow()` is typed as returning `void` (not a
 * `Promise`), so `await expect(promise).rejects.toThrow(...)` trips this
 * repo's `ts/await-thenable` lint rule. A plain try/catch avoids the false
 * positive without weakening the assertion — mirrors `meal-plan.test.ts`.
 */
async function expectEdgeFunctionError(promise: Promise<unknown>): Promise<EdgeFunctionError> {
  let thrownError: unknown;
  try {
    await promise;
  }
  catch (error) {
    thrownError = error;
  }
  expect(thrownError).toBeInstanceOf(EdgeFunctionError);
  return thrownError as EdgeFunctionError;
}

const SAMPLE_REQUEST: GenerateMealPlanRequest = {
  semana_iso: '2026-W32',
  fecha_inicio: '2026-08-03',
};

const SAMPLE_RESPONSE: GenerateMealPlanResponse = {
  meal_plan_id: 'plan-1',
  semana_iso: '2026-W32',
  menu: {} as GenerateMealPlanResponse['menu'],
  advertencias: [],
  explicacion_aprendizaje: null,
};

describe('generateMealPlan', () => {
  test('returns the parsed JSON body on a successful call', async () => {
    stubFetch({ ok: true, status: 200, body: SAMPLE_RESPONSE });

    const result = await generateMealPlan(SAMPLE_REQUEST, 'user-token');

    expect(result).toEqual(SAMPLE_RESPONSE);
  });

  test('POSTs to the correct Edge Function URL with the request body as JSON', async () => {
    stubFetch({ ok: true, status: 200, body: SAMPLE_RESPONSE });

    await generateMealPlan(SAMPLE_REQUEST, 'user-token');

    expect(lastFetchCall?.url).toBe(`${FUNCTIONS_URL}/generate-meal-plan`);
    expect(lastFetchCall?.init.method).toBe('POST');
    expect(lastFetchCall?.init.body).toBe(JSON.stringify(SAMPLE_REQUEST));
  });

  test('sends Authorization: Bearer <token> when an access token is passed', async () => {
    stubFetch({ ok: true, status: 200, body: SAMPLE_RESPONSE });

    await generateMealPlan(SAMPLE_REQUEST, 'user-token');

    const headers = lastFetchCall?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer user-token');
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('omits the Authorization header entirely for a null (guest) token', async () => {
    stubFetch({ ok: true, status: 200, body: SAMPLE_RESPONSE });

    await generateMealPlan(SAMPLE_REQUEST, null);

    const headers = lastFetchCall?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('throws EdgeFunctionError with the real status and message on a 422 response', async () => {
    stubFetch({ ok: false, status: 422, body: { error: 'No hay ninguna receta segura para tus restricciones' } });

    const error = await expectEdgeFunctionError(generateMealPlan(SAMPLE_REQUEST, 'user-token'));

    expect(error.status).toBe(422);
    expect(error.message).toBe('No hay ninguna receta segura para tus restricciones');
    expect(error.body).toEqual({ error: 'No hay ninguna receta segura para tus restricciones' });
  });

  test('throws EdgeFunctionError with the real status and message on a 500 response', async () => {
    stubFetch({ ok: false, status: 500, body: { error: 'Internal server error' } });

    const error = await expectEdgeFunctionError(generateMealPlan(SAMPLE_REQUEST, 'user-token'));

    expect(error.status).toBe(500);
    expect(error.message).toBe('Internal server error');
  });

  test('falls back to statusText when the error response body is not valid JSON', async () => {
    globalThis.fetch = (async () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    } as unknown as Response)) as unknown as typeof fetch;

    const error = await expectEdgeFunctionError(generateMealPlan(SAMPLE_REQUEST, 'user-token'));

    expect(error.status).toBe(503);
    expect(error.message).toBe('Service Unavailable');
  });
});

describe('generateShoppingList', () => {
  test('POSTs to /generate-shopping-list and returns the parsed body', async () => {
    const body = { shopping_list_id: 'list-1', pasillos: [], resumen: { total_items: 0, coste_estimado_min: 0, coste_estimado_max: 0, moneda: 'EUR' as const } };
    stubFetch({ ok: true, status: 200, body });

    const result = await generateShoppingList({ meal_plan_id: 'plan-1' }, 'user-token');

    expect(lastFetchCall?.url).toBe(`${FUNCTIONS_URL}/generate-shopping-list`);
    expect(result).toEqual(body);
  });

  test('throws EdgeFunctionError on a non-2xx response', async () => {
    stubFetch({ ok: false, status: 404, body: { error: 'meal plan not found' } });

    const error = await expectEdgeFunctionError(generateShoppingList({ meal_plan_id: 'missing' }, 'user-token'));

    expect(error.status).toBe(404);
    expect(error.message).toBe('meal plan not found');
  });
});

describe('updateRecipeStatus', () => {
  test('POSTs to /update-recipe-status and returns the parsed body', async () => {
    const body = { ok: true as const, estado: 'cocinada' };
    stubFetch({ ok: true, status: 200, body });

    const result = await updateRecipeStatus(
      { meal_plan_recipe_id: 'slot-1', estado: 'cocinada' },
      'user-token',
    );

    expect(lastFetchCall?.url).toBe(`${FUNCTIONS_URL}/update-recipe-status`);
    expect(result).toEqual(body);
  });
});

const SAMPLE_REASSIGN_REQUEST: ReassignGuestDataRequest = {
  targetAccessToken: 'target-session-token',
};

describe('reassignGuestData', () => {
  test('POSTs the target token in the body, on the guest access token (ADR-0022)', async () => {
    const body: ReassignGuestDataResponse = { reassigned: true };
    stubFetch({ ok: true, status: 200, body });

    const result = await reassignGuestData(SAMPLE_REASSIGN_REQUEST, 'guest-token');

    expect(lastFetchCall?.url).toBe(`${FUNCTIONS_URL}/reassign-guest-data`);
    const headers = lastFetchCall?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer guest-token');
    expect(lastFetchCall?.init.body).toBe(JSON.stringify({ targetAccessToken: 'target-session-token' }));
    expect(result).toEqual(body);
  });

  test('throws EdgeFunctionError on a non-2xx response', async () => {
    stubFetch({ ok: false, status: 409, body: { error: 'account already linked' } });

    const error = await expectEdgeFunctionError(
      reassignGuestData(SAMPLE_REASSIGN_REQUEST, 'guest-token'),
    );

    expect(error.status).toBe(409);
    expect(error.message).toBe('account already linked');
  });
});
