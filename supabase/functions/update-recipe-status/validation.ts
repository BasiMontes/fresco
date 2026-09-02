// Pure request-body validation for update-recipe-status, kept out of index.ts
// so it runs under `bun test` without importing index.ts (which calls
// Deno.serve() at module scope) — same "extract the pure logic" pattern as
// generate-meal-plan/menu-selector.ts.
//
// A4-H1 / A4-L7 (audit-4): the raw enum column was the only thing rejecting a
// bad `estado`, producing an ugly 500, and `rating` was compared with `<`/`>`
// so `"3"`, `3.7` and `null` all slipped through.

import { HttpError } from '../_shared/http.ts'

/**
 * The subset of estado_receta_menu a client is allowed to set through this
 * endpoint. `pendiente` and `excluida` are system-assigned (menu generation),
 * never a client transition.
 */
export const CLIENT_SETTABLE_ESTADOS = ['cocinada', 'descartada', 'sustituida'] as const
export type ClientSettableEstado = (typeof CLIENT_SETTABLE_ESTADOS)[number]

export function assertEstadoValido(estado: unknown): asserts estado is ClientSettableEstado {
  if (typeof estado !== 'string' || !(CLIENT_SETTABLE_ESTADOS as readonly string[]).includes(estado)) {
    throw new HttpError(
      `estado no válido: se espera uno de ${CLIENT_SETTABLE_ESTADOS.join(', ')}`,
      400,
    )
  }
}

export function assertRatingValido(rating: unknown): void {
  if (rating === undefined) return
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError('El rating debe ser un entero entre 1 y 5', 400)
  }
}

/**
 * A4-L7 (audit-4): the update payload for meal_plan_recipes, holding only the
 * fields the target `estado` actually permits.
 *
 * - `recipe_id` moves ONLY on `sustituida` — the one path that runs the
 *   allergen/diet re-filter + duplicate check in index.ts step 6. Letting it
 *   through on `cocinada`/`descartada` would persist an unvetted recipe.
 * - `rating` is a signal about a dish the user cooked, so it is dropped for
 *   `sustituida` (nothing was cooked).
 */
export function buildUpdatePayload(
  estado: ClientSettableEstado,
  rating: number | undefined,
  nuevaRecipeId: string | undefined,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { estado }
  if (rating !== undefined && estado !== 'sustituida') payload.rating = rating
  if (nuevaRecipeId !== undefined && estado === 'sustituida') payload.recipe_id = nuevaRecipeId
  return payload
}
