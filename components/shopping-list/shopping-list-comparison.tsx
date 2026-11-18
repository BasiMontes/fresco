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

/**
 * FRESCO-1222 — "Comparar tu compra". Real chains and estimated chains are two separate lists, and every
 * estimated figure carries its own "Estimado, basado en Mercadona" label next to it: a figure is never worded
 * as the chain's price, and it always says how many of the list's products it covers, so it never reads as the
 * whole basket. A chain with nothing to show is not rendered.
 */
export function ShoppingListComparison({ reales, estimadas }: ShoppingListComparisonProps) {
  if (reales.length === 0 && estimadas.length === 0) { return null; }
  return (
    <Card className="mt-4" data-testid="shopping_list_comparison">
      <h2 className="text-h5">Comparar tu compra</h2>
      <p className="mt-1 text-body-sm text-tertiary">
        Cada cifra suma solo los productos que se indican; no es el total de tu lista.
      </p>

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

      {estimadas.length > 0 && (
        <section className="mt-3" aria-labelledby="shopping_list_comparison_estimadas_title">
          <h3 id="shopping_list_comparison_estimadas_title" className="text-body-sm uppercase tracking-wide text-tertiary">
            Otras cadenas, solo básicos de marca propia
          </h3>
          <ul className="mt-1 flex flex-col gap-2">
            {estimadas.map(total => (
              <li key={total.cadena} data-testid={`shopping_list_comparison_estimada_${total.cadena}`} className="flex items-baseline justify-between gap-3">
                <span className="text-body">
                  {total.nombre}
                  <span className="block text-body-sm text-tertiary">{cobertura(total)}</span>
                </span>
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
