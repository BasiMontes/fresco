import type { TotalComparado } from '@/lib/grocery/estimacion-cadenas';
import { Card } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import { formatPrecio } from '@/lib/utils';

interface ShoppingListComparisonProps {
  /** Chains with real data (their own linked products), already summed. */
  reales: readonly TotalComparado[]
  /** FRESCO-1222 — chains with no data of their own: the labelled estimate over Mercadona. */
  estimadas: readonly TotalComparado[]
}

function cobertura({ incluidos, productos }: Pick<TotalComparado, 'incluidos' | 'productos'>): string {
  return `${incluidos} de ${productos} ${productos === 1 ? 'producto' : 'productos'}`;
}

/** "leche", "leche y arroz", "leche, arroz y pasta". */
function enumerar(nombres: readonly string[]): string {
  if (nombres.length <= 1) { return nombres.join(''); }
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * FRESCO-1222 — "Comparar tu compra". Two separate blocks that must not be read as one comparison: the real totals
 * (whole priced basket per chain, with coverage) and the estimate (only the staples it names, over Mercadona's
 * price). Every estimated figure carries its own "Estimado, basado en Mercadona" label, a figure is never worded as
 * the chain's price, and the estimate block says it is not comparable with the totals. A chain with nothing to show
 * is not rendered.
 */
export function ShoppingListComparison({ reales, estimadas }: ShoppingListComparisonProps) {
  if (reales.length === 0 && estimadas.length === 0) { return null; }
  const resumen = estimadas[0];
  return (
    <Card className="mt-4" data-testid="shopping_list_comparison">
      <h2 className="text-h5">Comparar tu compra</h2>

      {reales.length > 0 && (
        <section className="mt-3" aria-labelledby="shopping_list_comparison_reales_title">
          <h3 id="shopping_list_comparison_reales_title" className="text-body-sm uppercase tracking-wide text-tertiary">
            Con precios de la cadena
          </h3>
          <ul className="mt-1 flex flex-col gap-1">
            {reales.map(total => (
              <li key={total.cadena} data-testid={`shopping_list_comparison_real_${total.cadena}`} className="flex items-baseline justify-between gap-3">
                <span className="text-body">
                  {total.nombre}
                  <span className="block text-body-sm text-tertiary">{cobertura(total)}</span>
                </span>
                <span className="font-heading text-h5 font-normal text-primary">{formatPrecio(total.importe)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resumen && (
        <section className="mt-4 border-t border-border pt-3" aria-labelledby="shopping_list_comparison_estimadas_title" data-testid="shopping_list_comparison_estimadas">
          <h3 id="shopping_list_comparison_estimadas_title" className="text-body-sm uppercase tracking-wide text-tertiary">
            Estimación de básicos
          </h3>
          <p data-testid="shopping_list_comparison_estimadas_alcance" className="mt-1 text-body">
            {`${enumerar(resumen.basicos ?? [])}, ${cobertura(resumen)}`}
          </p>
          <p data-testid="shopping_list_comparison_estimadas_aviso" className="mt-1 text-body-sm text-tertiary">
            {reales.length > 0
              ? 'Es una estimación solo de esos básicos de marca propia, y no es comparable con los totales de arriba.'
              : 'Es una estimación solo de esos básicos de marca propia, no el total de tu compra.'}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {estimadas.map(total => (
              <li key={total.cadena} data-testid={`shopping_list_comparison_estimada_${total.cadena}`} className="flex items-center justify-between gap-3">
                <span className="text-body">{total.nombre}</span>
                <span className="flex flex-col items-end gap-1">
                  <span className="font-heading text-h5 font-normal text-primary">{formatPrecio(total.importe)}</span>
                  <Tag data-testid={`shopping_list_comparison_estimada_etiqueta_${total.cadena}`}>Estimado, basado en Mercadona</Tag>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}
