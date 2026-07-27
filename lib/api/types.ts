/**
 * Types for the 3 Supabase Edge Functions documented in
 * `.context/SRS/api-contracts.md`. Request/response shapes for
 * `generate-meal-plan`, `generate-shopping-list`, and `update-recipe-status`
 * are copied verbatim from that document (§1, §2, §4). `Recipe` is not given
 * as a single interface there — it is reconstructed from the field
 * vocabulary named across §1a ("serialized compactly: id, name, type,
 * category, cuisine, minutes, cost bucket, seasons, richness/lightness
 * flags, tupper-suitability, and the learning fields") and §5 (the
 * `recipes` write shape). Field names stay in Spanish where the source
 * document uses Spanish domain vocabulary — do not translate them, the
 * backend's Supabase schema is expected to match this vocabulary 1:1.
 */

export type DiaSemana
  = | 'lunes'
    | 'martes'
    | 'miercoles'
    | 'jueves'
    | 'viernes'
    | 'sabado'
    | 'domingo';

export type TipoPlato = 'desayuno' | 'comida' | 'cena';

export type EstadoRecetaSlot = 'pendiente' | 'cocinada' | 'descartada' | 'sustituida';

/** A single recipe as embedded in a generated menu slot (api-contracts.md §1, §1a, §5). */
export interface Recipe {
  id: string
  nombre: string
  slug: string
  tipo: TipoPlato
  categoria: string
  cocina: string
  minutos: number
  coste_bucket: string
  temporada: string[]
  apto_tupper: boolean
  dieta: string[]
  alergenos: string[]
  ingredientes_principales: string[]
  ingredientes_que_puede_desagradar: string[]
  descripcion_corta: string // <= 120 chars per api-contracts.md §5
  pasos_resumen: string[] // <= 5 steps per api-contracts.md §5
  /** Learning fields — populated by `recipe_learning_trigger`, read-only from the frontend. */
  veces_cocinada: number
  veces_descartada: number
  rating_promedio: number | null
  ultima_vez_en_menu: string | null // ISO date
}

// --- 1. POST /generate-meal-plan (api-contracts.md §1) ---------------------
//
// `GenerateMealPlanRequest`/`GenerateMealPlanResponse` used to be
// hand-duplicated here, diverged from the canonical `@schemas` facade (this
// file's `Recipe` below is a flat shape; the live Edge Function actually
// returns the nested `clasificacion`/`meta`/`dieta` shape from
// `api/schemas/recipe.types.ts`), and `lib/api/edge-functions.ts` now imports
// both directly from `@schemas` instead. Removed here rather than
// re-exported, since `Recipe` below still can't be re-pointed to `@schemas`
// without breaking `components/recipe/recipe-card.tsx` and
// `lib/mock/recipes.ts`, which still consume this flat shape (out of scope
// for this story — batch 2/3 wiring work).

// --- 2. POST /generate-shopping-list (api-contracts.md §2) -----------------

export interface GenerateShoppingListRequest {
  meal_plan_id: string // uuid — must already exist and belong to the caller
}

export interface ShoppingListItem {
  nombre: string
  cantidad: number
  unidad: string
  comprado: boolean
}

export interface ShoppingListPasillo {
  nombre: string // exact aisle name, from the fixed 13-aisle vocabulary
  orden: number
  items: ShoppingListItem[]
}

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
