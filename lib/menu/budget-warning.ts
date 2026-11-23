/**
 * FRESCO-1269 (QAFRESCO-2): the weekly-budget warning, computed from the SAME figure the "Gasto semanal
 * estimado" tile shows (`costeSemanalEstimado`). It used to be computed twice, once per recipe cost bucket in the
 * `generate-meal-plan` Edge Function and once per ingredient on this page, so the tile could read 97,32 € over a
 * 90 € budget while the warning stayed silent. There is one estimate now and this is its only consumer.
 */

/** The text every budget warning starts with; also how a stale stored one is recognised and replaced. */
const PREFIJO_EXCESO = 'El menú supera tu presupuesto semanal';

/** Written by the old Edge calculation when a recipe had no cost bucket; meaningless now that the estimate is the tile's. */
const PREFIJO_APROXIMADO = 'El cálculo de presupuesto es aproximado';

/**
 * The warning for a menu costing `coste` against `presupuesto`, or `null` when there is nothing to say: no budget,
 * no estimate (the calculation failed and the tile is hidden), or a cost that is at or under the budget.
 */
export function avisoPresupuesto(coste: number | undefined, presupuesto: number | null | undefined): string | null {
  if (coste === undefined || presupuesto == null || !Number.isFinite(coste) || !Number.isFinite(presupuesto)) {
    return null;
  }

  const exceso = coste - presupuesto;

  return exceso > 0 ? `${PREFIJO_EXCESO} en aproximadamente ${exceso.toFixed(2)}€` : null;
}

/**
 * `advertencias` with any budget warning already stored replaced by `aviso` (or dropped when `aviso` is `null`).
 * A plan generated before this change carries the old estimate's message; showing it next to the tile's figure
 * would be the very contradiction this fixes. Every other warning keeps its place and order.
 */
export function advertenciasConPresupuesto(advertencias: readonly string[], aviso: string | null): string[] {
  const resto = advertencias.filter(a => !a.startsWith(PREFIJO_EXCESO) && !a.startsWith(PREFIJO_APROXIMADO));

  return aviso === null ? resto : [...resto, aviso];
}
