// Pure request-body validation for update-recipe-status, kept out of index.ts
// so it runs under `bun test` without importing index.ts (which calls
// Deno.serve() at module scope) — same "extract the pure logic" pattern as
// generate-meal-plan/menu-selector.ts.
//
// A4-H1 / A4-L7 (audit-4): the raw enum column was the only thing rejecting a
// bad `estado`, producing an ugly 500.
//
// FRESCO-1012 (A7-LOGIC-10): the rating path is retired. No screen ever sent a rating and a `cocinada`
// slot cannot be patched again, so it never fed anything; the menu selector no longer weighs it either.
// A `rating` in the body is ignored. Decision recorded in ADR-0063.

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

/**
 * A4-L7 (audit-4): the update payload for meal_plan_recipes, holding only the
 * fields the target `estado` actually permits.
 *
 * - `recipe_id` moves ONLY on `sustituida` — the one path that runs the
 *   allergen/diet re-filter + duplicate check in index.ts step 6. Letting it
 *   through on `cocinada`/`descartada` would persist an unvetted recipe.
 */
export function buildUpdatePayload(
  estado: ClientSettableEstado,
  nuevaRecipeId: string | undefined,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { estado }
  if (nuevaRecipeId !== undefined && estado === 'sustituida') payload.recipe_id = nuevaRecipeId
  return payload
}
