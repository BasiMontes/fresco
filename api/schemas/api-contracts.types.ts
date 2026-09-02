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

// POST /reassign-guest-data — ADR-0004 (FRESCO-20), verification step revised
// by ADR-0022 (FRESCO-395 / A4-L4). Caller's `Authorization` header holds the
// guest's still-active anonymous session; `targetAccessToken` is a real
// (non-anonymous) session token the caller obtained by authenticating to the
// target account through native Supabase Auth. The function verifies that
// token — it never receives or checks a password, so it can't be used as a
// brute-force oracle.
export interface ReassignGuestDataRequest {
  targetAccessToken: string
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

// POST /delete-account — `/profile` danger zone. The caller is resolved from
// her own Authorization header and can only ever delete her own account.
// Cascades through every user-owned table at the DB level
// (`user_profiles.id -> auth.users.id ON DELETE CASCADE`, migration
// 20260725120100), so the Edge Function itself needs no RPC, unlike
// `reassign-guest-data`.
//
// FRESCO-397 (A4-L11): a registered caller must prove a RECENT
// re-authentication — the client re-logs via native Supabase Auth
// (`signInWithPassword`) and passes the resulting access token as
// `reauthToken`; the function only verifies it (same user id + `iat` inside
// the freshness window), never a password, mirroring ADR-0022. An anonymous
// (guest) caller has no password to re-enter, so `reauthToken` is omitted
// for guests and the function relies on the per-user rate limit alone —
// guest data is disposable and the identity itself is deleted here anyway.
export interface DeleteAccountRequest {
  /** Fresh Supabase access token from a re-login. Required for a registered caller, omitted for a guest. */
  reauthToken?: string
}

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
