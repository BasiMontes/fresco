import type { IngredienteCantidad, UnidadIngrediente } from '@schemas';

/**
 * FRESCO-863 — how a catalog ingredient quantity reads on the recipe detail:
 * "400 g", "3 dientes", "1 cucharadita", "al gusto". The number comes first and
 * the ingredient name is shown beside it, so no Spanish noun is ever pluralised
 * or glued to the unit ("2 ud. plátano" instead of guessing "2 plátanos" /
 * "2 limones" / "2 panes"). A non-breaking space keeps "400 g" on one line.
 *
 * Plain data module (no JSX), importable from server and client components.
 */
const NUMBER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const NBSP = ' ';

const SINGULAR_PLURAL: Partial<Record<UnidadIngrediente, [string, string]>> = {
  dientes: ['diente', 'dientes'],
  cucharadas: ['cucharada', 'cucharadas'],
  cucharaditas: ['cucharadita', 'cucharaditas'],
  pizca: ['pizca', 'pizcas'],
};

export function formatCantidad({ cantidad, unidad }: Pick<IngredienteCantidad, 'cantidad' | 'unidad'>): string {
  if (unidad === 'al gusto') { return 'al gusto'; }

  const number = NUMBER.format(cantidad);
  if (unidad === 'g' || unidad === 'ml') { return `${number}${NBSP}${unidad}`; }
  if (unidad === 'unidades') { return `${number}${NBSP}ud.`; }

  const [singular, plural] = SINGULAR_PLURAL[unidad] ?? [unidad, unidad];
  return `${number}${NBSP}${cantidad === 1 ? singular : plural}`;
}
