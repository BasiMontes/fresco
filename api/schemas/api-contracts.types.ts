import type { DiaSemana, EstadoRecetaMenu } from './meal-plan.types.ts';
import type { Recipe } from './recipe.types.ts';
import type { ShoppingListPasillo } from './shopping-list.types.ts';

// Request/response contracts for the 3 Edge Functions, per
// .context/SRS/api-contracts.md. Single source of truth shared between the
// Edge Functions (imported via relative path — Deno has no bundler alias
// resolution) and the future frontend (imported via the `@schemas/*` alias).

export type TipoPlatoSlot = 'desayuno' | 'comida' | 'cena';

// POST /generate-meal-plan — api-contracts.md §1
export interface GenerateMealPlanRequest {
  semana_iso: string // 'YYYY-WXX'
  fecha_inicio: string // 'YYYY-MM-DD', Monday of that week
}

export interface GenerateMealPlanResponse {
  meal_plan_id: string
  semana_iso: string
  /**
   * A slot is `null` when the deterministic selector (ADR-0005) correctly
   * found no safe recipe for it (FR-8.2 / AC Scenario 4, FRESCO-23) — paired
   * with an explanatory entry in `advertencias`, never silent.
   */
  menu: Record<DiaSemana, Record<TipoPlatoSlot, Recipe | null>>
  /** MUST be surfaced to the user when non-empty — FR-2.10 / FR-8.2. */
  advertencias: string[]
  /** FR-5.5, Pro + real history only. `null` otherwise — kept separate from `advertencias`. */
  explicacion_aprendizaje: string | null
}

// POST /reassign-guest-data — ADR-0004 (FRESCO-20). Caller must hold an
// active anonymous session; `email`/`password` identify the real, existing
// account the guest's data should move to (verified server-side, never
// trusted as-is).
export interface ReassignGuestDataRequest {
  email: string
  password: string
}

export interface ReassignGuestDataResponse {
  reassigned: boolean
}

// POST /generate-shopping-list — api-contracts.md §2
export interface GenerateShoppingListRequest {
  meal_plan_id: string
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

// POST /get-shopping-list-suggestions — FRESCO-194. Real data only:
// ingredients from the caller's own favorited recipes not already in the
// given list. No suggestion/recency data exists elsewhere in this app.
export interface GetShoppingListSuggestionsRequest {
  shopping_list_id: string
}

export interface ShoppingListSuggestion {
  nombre: string
  pasillo: string
  cantidad: number
  unidad: string
  precio_estimado: number
}

export interface GetShoppingListSuggestionsResponse {
  suggestions: ShoppingListSuggestion[]
}

// PATCH /update-recipe-status (via Edge Function update-recipe-status) — api-contracts.md §4
export interface UpdateRecipeStatusRequest {
  meal_plan_recipe_id: string
  estado: EstadoRecetaMenu
  /** 1-5, only meaningful when estado = 'cocinada'. */
  rating?: number
  /** required when estado = 'sustituida'. */
  nueva_recipe_id?: string
}

export interface UpdateRecipeStatusResponse {
  ok: true
  estado: EstadoRecetaMenu
}

/** Shape of every non-2xx response across all three Edge Functions (api-contracts.md §0). */
export interface ApiErrorResponse {
  error: string
}

// POST /delete-catalog-recipe — admin-only catalog maintenance (FRESCO-237).
// Caller must be in the ADMIN_USER_ID allowlist (_shared/admin.ts); the
// actual delete runs through a service-role client since `recipes` has no
// authenticated-role write RLS policy.
export interface DeleteCatalogRecipeRequest {
  recipe_id: string
}

export interface DeleteCatalogRecipeResponse {
  id: string
  slug: string
}

// POST /delete-account — `/profile` danger zone. No request body; the
// caller is resolved from her own Authorization header and can only ever
// delete her own account. Cascades through every user-owned table at the DB
// level (`user_profiles.id -> auth.users.id ON DELETE CASCADE`, migration
// 20260725120100), so the Edge Function itself needs no RPC, unlike
// `reassign-guest-data`.
export interface DeleteAccountResponse {
  deleted: boolean
}

// POST /send-weekly-reengagement-push — FRESCO-241 PR3 (ADR-0011/ADR-0012).
// No request body: triggered exclusively by pg_cron -> pg_net, never by a
// client, so there is nothing for a caller to pass. Auth is a service_role
// bearer check (see the function's own `requireServiceRoleCaller`), not a
// per-user JWT -- this contract exists for observability (the cron job's
// response is inspectable via Edge Function logs), not for a frontend caller.
export interface SendWeeklyPushRemindersResponse {
  /** ISO week the send ran for, e.g. '2026-W35'. */
  semana_iso: string
  /** Distinct users with >=1 push_subscriptions row and no meal_plans row for semana_iso. */
  users_targeted: number
  /** Individual webpush.sendNotification() calls that succeeded (one per subscription/device). */
  notifications_sent: number
  /** push_subscriptions rows deleted this run after a 404/410 from the push service (AC5). */
  stale_subscriptions_removed: number
}
