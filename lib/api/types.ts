/**
 * Types for the 3 Supabase Edge Functions documented in
 * `.context/SRS/api-contracts.md`. Request/response shapes for
 * `generate-meal-plan`, `generate-shopping-list`, and `update-recipe-status`
 * are copied verbatim from that document (§1, §2, §4). Field names stay in
 * Spanish where the source document uses Spanish domain vocabulary — do not
 * translate them, the backend's Supabase schema is expected to match this
 * vocabulary 1:1.
 */

import type { ShoppingListItem, ShoppingListPasillo } from '@schemas';

export type DiaSemana
  = | 'lunes'
    | 'martes'
    | 'miercoles'
    | 'jueves'
    | 'viernes'
    | 'sabado'
    | 'domingo';

export type TipoPlato = 'desayuno' | 'comida' | 'cena';

export type EstadoRecetaSlot = 'pendiente' | 'cocinada' | 'descartada' | 'sustituida' | 'excluida';

/**
 * `Recipe` used to be hand-duplicated here as a flat shape (`tipo`,
 * `categoria`, `cocina`, `coste_bucket` as scalar strings), diverged from the
 * canonical `@schemas` facade (the live Edge Function/DB shape nests these
 * under `clasificacion`/`meta`/`dieta` objects — `api/schemas/recipe.types.ts`).
 * Re-exported from `@schemas` instead of redeclared, so the two can never
 * diverge again (STORY-FRESCO-7 batch 2) — `components/recipe/recipe-card.tsx`
 * and `lib/mock/recipes.ts` now consume the real nested shape.
 */
export type { Recipe } from '@schemas';

// --- 1. POST /generate-meal-plan (api-contracts.md §1) ---------------------
//
// `GenerateMealPlanRequest`/`GenerateMealPlanResponse` are imported directly
// from `@schemas` at their one call site (`lib/api/edge-functions.ts`), not
// re-exported here — nothing in this file needs them.

// --- 2. POST /generate-shopping-list (api-contracts.md §2) -----------------

export interface GenerateShoppingListRequest {
  meal_plan_id: string // uuid — must already exist and belong to the caller
}

/**
 * Re-exported from `@schemas` instead of hand-duplicated, same fix as the
 * `Recipe` re-export above (STORY-FRESCO-7 batch 2) — this pair used to be
 * a separate hand-copied shape here that silently drifted out of sync when
 * `precio_estimado` was added to the canonical `ShoppingListItem` (FRESCO-191).
 */
export type { ShoppingListItem, ShoppingListPasillo };

export interface GenerateShoppingListResponse {
  shopping_list_id: string
  pasillos: ShoppingListPasillo[]
  resumen: {
    total_items: number
    coste_estimado_min: number
    coste_estimado_max: number
    moneda: 'EUR'
  }
}

// --- 3. Item-level shopping-list toggle (api-contracts.md §3) --------------
// Not an Edge Function — a direct Supabase client call backed by a
// `security definer` SQL function (`jsonb_set_comprado`). Call it via the
// browser client (`lib/supabase/client.ts`) as
// `supabase.rpc('jsonb_set_comprado', params)` — wiring it into a component
// is per-story `/sprint-development` work, not part of this frontend layer.
export interface ToggleShoppingListItemParams {
  p_list_id: string
  p_pasillo_idx: number
  p_item_idx: number
  p_comprado: boolean
}

/** `jsonb_add_item` RPC params — mirrors `ToggleShoppingListItemParams` above, same direct-Supabase-client pattern. */
export interface AddShoppingListItemParams {
  p_list_id: string
  p_pasillo_nombre: string
  p_item: ShoppingListItem
}

// --- 3b. POST /get-shopping-list-suggestions (FRESCO-194) -------------------

export type { GetShoppingListSuggestionsRequest, GetShoppingListSuggestionsResponse, ShoppingListSuggestion } from '@schemas';

// --- 4. PATCH /update-recipe-status (api-contracts.md §4) ------------------

export interface UpdateRecipeStatusRequest {
  meal_plan_recipe_id: string // uuid, required
  estado: EstadoRecetaSlot // required
  rating?: number // 1-5, only meaningful when estado = 'cocinada'
  nueva_recipe_id?: string // uuid, required when estado = 'sustituida'
}

export interface UpdateRecipeStatusResponse {
  ok: true
  estado: string
}

/** Shape of every non-2xx Edge Function response (api-contracts.md §0). */
export interface EdgeFunctionErrorResponse {
  error: string
}
