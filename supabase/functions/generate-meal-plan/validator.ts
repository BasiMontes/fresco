// Server-side output validation — FR-2.9. Safety-critical structural checks
// on the model's response, independent of how the prompt was worded, so this
// is implemented for real (unlike prompt.ts's TODOs): valid JSON; `semana`
// matches; all 7x3 slots present; every recipe_id exists in the filtered
// catalog; no lunch/dinner repeat; breakfast repeats <= 3. Failing any check
// triggers a retry in index.ts (MAX_RETRIES = 2); exhausting retries returns
// 422 (AC-4, distinct from a genuine upstream 502) — an invalid menu is
// never persisted.

import type { DiaSemana, Recipe, TipoPlatoSlot } from './types.ts'
import type { CosteEstimado } from '../../../api/schemas/recipe.types.ts'
import { NO_SAFE_RECIPE_SENTINEL } from './types.ts'

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const TIPOS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena']
const MAX_BREAKFAST_REPEATS = 3

// FR-2.2/AC Scenario 2: no numeric per-recipe price exists in the schema
// (`recipe.meta.coste_estimado` is a 4-value categorical enum) — these are
// approximate per-recipe euro midpoints per bucket, confirmed against real
// Spanish grocery pricing. Structural budget check, not a precise total.
const BUCKET_MIDPOINT_EUROS: Record<CosteEstimado, number> = {
  muy_bajo: 1.5,
  bajo: 3,
  medio: 5,
  alto: 8,
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  /**
   * FR-8.2 / AC Scenario 4 (FRESCO-23): slots (`"dia.tipo"`) the model
   * correctly flagged via `NO_SAFE_RECIPE_SENTINEL`, paired with a real
   * `advertencias` entry — never populated for a malformed/ambiguous
   * response (that stays a generic error, still retried normally). Retrying
   * a genuinely reported unsafe slot is pointless — the same catalog and
   * profile produce the same result — so `index.ts` stops immediately when
   * this is non-empty instead of burning the remaining attempts.
   */
  unsafeSlots: string[]
}

export interface ValidateMenuOutputParams {
  raw: unknown
  validRecipeIds: Set<string>
  semanaIso: string
  recipeById: Map<string, Recipe>
  presupuestoSemanaEuros: number | null
}

// CLAUDE.md §10: 3+ params → object param, hence the single-object signature.
export function validateMenuOutput({
  raw,
  validRecipeIds,
  semanaIso,
  recipeById,
  presupuestoSemanaEuros,
}: ValidateMenuOutputParams): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const unsafeSlots: string[] = []

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['La respuesta de la IA no es un objeto JSON válido'], warnings, unsafeSlots }
  }

  const menu = raw as Record<string, unknown>

  if (menu.semana !== semanaIso) {
    errors.push(`Campo "semana" incorrecto: esperado ${semanaIso}, recibido ${String(menu.semana)}`)
  }

  if (!menu.menu || typeof menu.menu !== 'object') {
    return { valid: false, errors: [...errors, 'Falta el campo "menu"'], warnings, unsafeSlots }
  }

  const menuDias = menu.menu as Record<string, unknown>
  const usedIds = new Set<string>() // detects lunch/dinner duplicates
  const desayunoIds: string[] = []
  const allRecipeIds: string[] = [] // every valid slot, for the budget check below

  for (const dia of DIAS) {
    if (!menuDias[dia] || typeof menuDias[dia] !== 'object') {
      errors.push(`Falta el día: ${dia}`)
      continue
    }

    const diaObj = menuDias[dia] as Record<string, unknown>

    for (const tipo of TIPOS) {
      const recipeId = diaObj[tipo]

      if (recipeId === NO_SAFE_RECIPE_SENTINEL) {
        // FR-8.2 / AC Scenario 4: correctly reported below, once we know
        // whether a real advertencia accompanies it — recorded here,
        // enforced after the loop. Never counted toward budget/repeat
        // checks; it isn't a real recipe.
        unsafeSlots.push(`${dia}.${tipo}`)
        continue
      }

      if (!recipeId || typeof recipeId !== 'string') {
        errors.push(`Slot vacío: ${dia}.${tipo}`)
        continue
      }

      if (!validRecipeIds.has(recipeId)) {
        errors.push(`ID inválido en ${dia}.${tipo}: ${recipeId} no existe en el catálogo filtrado`)
        continue
      }

      allRecipeIds.push(recipeId)

      if (tipo === 'desayuno') {
        desayunoIds.push(recipeId)
        continue
      }

      if (usedIds.has(recipeId)) {
        errors.push(`Receta repetida en ${dia}.${tipo}: ${recipeId}`)
      }
      usedIds.add(recipeId)
    }
  }

  // FR-8.2's contract: a sentinel-flagged slot must come with a real,
  // non-empty advertencia — "never silent". If the model used the sentinel
  // without one, this is a non-compliant response, not a cleanly-reported
  // one: treat it as a generic error (full retry, per the existing flow)
  // instead of the fast-fail path below, which only applies to a response
  // that actually honored the "never silent" rule.
  if (unsafeSlots.length > 0) {
    const hasAdvertencia = Array.isArray(menu.advertencias)
      && menu.advertencias.some(adv => typeof adv === 'string' && adv.trim().length > 0)

    if (!hasAdvertencia) {
      errors.push(
        `La IA marcó ${unsafeSlots.length} franja(s) sin receta segura (${unsafeSlots.join(', ')}) pero no incluyó ninguna advertencia explicativa`,
      )
      unsafeSlots.length = 0
    }
  }

  const desayunoCount = new Map<string, number>()
  for (const id of desayunoIds) {
    desayunoCount.set(id, (desayunoCount.get(id) ?? 0) + 1)
  }
  for (const [id, count] of desayunoCount) {
    if (count > MAX_BREAKFAST_REPEATS) {
      warnings.push(`Desayuno con ID ${id} aparece ${count} veces (máximo recomendado: ${MAX_BREAKFAST_REPEATS})`)
    }
  }

  // AC Scenario 2/5: structural budget check, soft-warn only (Decision 1 —
  // never a hard-fail/retry gate). Skipped entirely when the household never
  // declared a weekly budget.
  if (presupuestoSemanaEuros != null) {
    let totalEuros = 0
    for (const id of allRecipeIds) {
      const coste = recipeById.get(id)?.meta?.coste_estimado
      if (coste) totalEuros += BUCKET_MIDPOINT_EUROS[coste]
    }

    if (totalEuros > presupuestoSemanaEuros) {
      const overage = totalEuros - presupuestoSemanaEuros
      warnings.push(`El menú supera tu presupuesto semanal en aproximadamente ${overage.toFixed(2)}€`)
    }
  }

  // FR-2.10 / FR-8.2: the model's own advertencias are never silently discarded
  if (Array.isArray(menu.advertencias) && menu.advertencias.length > 0) {
    for (const adv of menu.advertencias) {
      if (typeof adv === 'string') warnings.push(`IA: ${adv}`)
    }
  }

  return { valid: errors.length === 0 && unsafeSlots.length === 0, errors, warnings, unsafeSlots }
}
