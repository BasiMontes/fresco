/**
 * Thin, typed client for this project's Supabase Edge Functions
 * (`.context/SRS/api-contracts.md` §0-§4 plus `reassign-guest-data`,
 * ADR-0004). The real Edge Functions are being scaffolded in parallel by the
 * backend-setup agent — these calls are stubs (they hit a real fetch, but
 * there is nothing live to respond yet). Swap the `mock` fallback for a real
 * network round-trip once the functions are deployed; the request/response
 * types are already final.
 */

import type {
  DeleteAccountResponse,
  DeleteCatalogRecipeRequest,
  DeleteCatalogRecipeResponse,
  GenerateMealPlanRequest,
  GenerateMealPlanResponse,
  ReassignGuestDataRequest,
  ReassignGuestDataResponse,
} from '@schemas';

import type {
  EdgeFunctionErrorResponse,
  GenerateShoppingListRequest,
  GenerateShoppingListResponse,
  GetShoppingListSuggestionsRequest,
  GetShoppingListSuggestionsResponse,
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
      // every call. `accessToken` is only ever null before a session exists
      // at all — guest sessions carry a real anonymous-user JWT (ADR-0003),
      // so in practice this branch is a defensive fallback, not the guest
      // path itself.
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({ error: response.statusText }))) as EdgeFunctionErrorResponse;
    // FRESCO-48: 401 here always means the JWT `requireAuthenticatedUser()`
    // checked was missing or expired (supabase/functions/_shared/auth.ts) —
    // every consumer (onboarding, shopping-list-generator, calendar-grid)
    // only ever distinguished 422/409 and fell through to a generic "no
    // pudimos..." message on this case, leaving the user staring at a wrong
    // error instead of being told to log back in. Handled once here rather
    // than in each consumer — this module is 'use client'-only (every
    // caller is a client component), so `window` is always defined.
    if (response.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login?session_expired=1';
    }
    throw new EdgeFunctionError(response.status, errorBody);
  }

  return response.json() as Promise<TResponse>;
}

/**
 * POST /generate-meal-plan — api-contracts.md §1.
 *
 * `accessToken` is `null`-typed for the brief window before the onboarding
 * page's mount effect resolves a session — by the time this is actually
 * called, `accessToken` is always a real Supabase JWT, guest or registered
 * (ADR-0003, FRESCO-17: guest mode uses `signInAnonymously()`, so a guest
 * has a real anonymous-session JWT, not an absent one).
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

/** POST /get-shopping-list-suggestions — FRESCO-194. */
export async function getShoppingListSuggestions(
  request: GetShoppingListSuggestionsRequest,
  accessToken: string | null,
): Promise<GetShoppingListSuggestionsResponse> {
  return callEdgeFunction<GetShoppingListSuggestionsResponse>(
    'get-shopping-list-suggestions',
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

/**
 * POST /reassign-guest-data — ADR-0004 (FRESCO-20). Called with the guest's
 * own (still-anonymous) access token; the request body's email/password
 * identify the real account to reassign her generated data to.
 */
export async function reassignGuestData(
  request: ReassignGuestDataRequest,
  accessToken: string,
): Promise<ReassignGuestDataResponse> {
  return callEdgeFunction<ReassignGuestDataResponse>('reassign-guest-data', request, accessToken);
}

/**
 * POST /delete-account — `/profile` danger zone (FRESCO-70). Irreversible;
 * permanently deletes the CURRENTLY authenticated user's account. No request
 * body — the caller is resolved server-side from `accessToken` alone, same
 * shape as every other call here, just an empty body.
 */
export async function deleteAccount(accessToken: string): Promise<DeleteAccountResponse> {
  return callEdgeFunction<DeleteAccountResponse>('delete-account', {}, accessToken);
}

/**
 * POST /delete-catalog-recipe — FRESCO-237 admin-only hard delete of a
 * catalog recipe. Admin gating happens entirely server-side
 * (`requireAdminUser()` inside the Edge Function, `ADMIN_USER_ID` allowlist)
 * — this client call carries no client-side admin check, same reasoning as
 * `deleteAccount` above. A recipe still referenced by a `meal_plan_recipes`
 * row surfaces as a 409 here (`EdgeFunctionError.body.error`), not a delete.
 */
export async function deleteCatalogRecipe(
  request: DeleteCatalogRecipeRequest,
  accessToken: string | null,
): Promise<DeleteCatalogRecipeResponse> {
  return callEdgeFunction<DeleteCatalogRecipeResponse>('delete-catalog-recipe', request, accessToken);
}

export { EdgeFunctionError };
