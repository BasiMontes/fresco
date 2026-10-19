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
 * endpoint. `excluida` is system-assigned (menu generation), never a client transition. `pendiente` is
 * how a mark is taken back (FRESCO-1014): only from `cocinada` / `descartada`, only in the current week.
 */
export const CLIENT_SETTABLE_ESTADOS = ['pendiente', 'cocinada', 'descartada', 'sustituida'] as const
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

export const TERMINAL_STATES: ReadonlySet<string> = new Set(['cocinada', 'descartada'])

/**
 * FRESCO-1014 (A7-UI-15) — which transitions a client may ask for, given the slot's current state.
 *
 * - A slot that is open (`pendiente`, `sustituida`, `excluida`) takes the transitions it always did, and cannot
 *   be "un-marked" because it has no mark.
 * - A marked slot (`cocinada` / `descartada`) used to be permanent after a five-second snackbar, so a mis-tap
 *   banned a dish for two weeks with no way back. Inside the CURRENT week it can now be taken back (`pendiente`)
 *   or switched to the other mark; in any other week it stays closed, and it can never be "replaced": a dish
 *   that was cooked or discarded is not swapped for another one.
 *
 * Throws the 409 the endpoint answers; returns when the transition is allowed.
 */
export function assertTransicionPermitida(
  { actual, nuevo, esSemanaActual }: { actual: string, nuevo: ClientSettableEstado, esSemanaActual: boolean },
): void {
  if (TERMINAL_STATES.has(actual)) {
    if (nuevo === actual || nuevo === 'sustituida') {
      throw new HttpError(`No se puede cambiar el estado de una receta ya marcada como "${actual}"`, 409)
    }
    if (!esSemanaActual) {
      throw new HttpError(`Solo puedes cambiar una marca dentro de la semana actual (esta receta está "${actual}")`, 409)
    }
    return
  }
  if (nuevo === 'pendiente') {
    throw new HttpError('Esta receta no tiene ninguna marca que quitar', 409)
  }
}
