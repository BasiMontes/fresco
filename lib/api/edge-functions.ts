/**
 * Thin, typed client for the 3 Supabase Edge Functions documented in
 * `.context/SRS/api-contracts.md` §0-§4. The real Edge Functions are being
 * scaffolded in parallel by the backend-setup agent — these calls are stubs
 * (they hit a real fetch, but there is nothing live to respond yet). Swap the
 * `mock` fallback for a real network round-trip once the functions are
 * deployed; the request/response types are already final.
 */

import type {
  GenerateMealPlanRequest,
  GenerateMealPlanResponse,
} from '@schemas';

import type {
  EdgeFunctionErrorResponse,
  GenerateShoppingListRequest,
  GenerateShoppingListResponse,
  UpdateRecipeStatusRequest,
  UpdateRecipeStatusResponse,
} from './types';

import { clientEnv } from '@/lib/env';

// api-contracts.md §0: `POST https://<project>.functions.supabase.co/<function-name>`

class EdgeFunctionError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: EdgeFunctionErrorResponse,
  ) {
    super(body.error);
    this.name = 'EdgeFunctionError';
  }
}

async function callEdgeFunction<TResponse>(
  functionName: string,
  body: unknown,
  accessToken: string | null,
): Promise<TResponse> {
  // Read (and, on first call, validate) here rather than at module scope —
  // fails fast the moment an Edge Function is actually invoked, without
  // forcing every page that merely imports this module (e.g. during
  // `next build`'s static prerendering) to have real Supabase env vars set.
  const response = await fetch(`${clientEnv.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL}/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // api-contracts.md §0: Authorization: Bearer <supabase-jwt> required on
      // every call. `accessToken` is null for a guest session — Supabase's
      // guest-mode auth path is itself unresolved (see below), so this will
      // 401 against a real deployment until that gap is closed.
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({ error: response.statusText }))) as EdgeFunctionErrorResponse;
    throw new EdgeFunctionError(response.status, errorBody);
  }

  return response.json() as Promise<TResponse>;
}

/**
 * POST /generate-meal-plan — api-contracts.md §1.
 *
 * TODO: guest-mode auth unresolved, see business-api-map.md — a guest
 * (unauthenticated) caller has no Supabase JWT to send here yet. Until the
 * guest-auth mechanism is decided, `accessToken` must come from a real
 * signed-in Supabase session; do not invent a guest-session workaround here.
 */
export async function generateMealPlan(
  request: GenerateMealPlanRequest,
  accessToken: string | null,
): Promise<GenerateMealPlanResponse> {
  return callEdgeFunction<GenerateMealPlanResponse>('generate-meal-plan', request, accessToken);
}

/** POST /generate-shopping-list — api-contracts.md §2. */
export async function generateShoppingList(
  request: GenerateShoppingListRequest,
  accessToken: string | null,
): Promise<GenerateShoppingListResponse> {
  return callEdgeFunction<GenerateShoppingListResponse>(
    'generate-shopping-list',
    request,
    accessToken,
  );
}

/** PATCH /update-recipe-status (via Edge Function) — api-contracts.md §4. */
export async function updateRecipeStatus(
  request: UpdateRecipeStatusRequest,
  accessToken: string | null,
): Promise<UpdateRecipeStatusResponse> {
  return callEdgeFunction<UpdateRecipeStatusResponse>(
    'update-recipe-status',
    request,
    accessToken,
  );
}

export { EdgeFunctionError };
