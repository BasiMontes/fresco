import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import { Card } from '@/components/ui/card';
import { formatImporte, formatPrecio } from '@/lib/utils';

interface ShoppingListSummaryProps {
  pendientes: number
  resumen: ShoppingListPersistido['resumen']
  /** FRESCO-1099 — the sum of the rows below (`totalDeLista`); absent (no row has a price) falls back to the stored range. */
  total: number | undefined
  /** FRESCO-1172 — how many rows the total covers; the rest print no price and are not in it. */
  cobertura: { conPrecio: number, articulos: number }
  /** FRESCO-790 — the chains that priced a row, as the shopper reads them ("Mercadona y Consum"); empty when none did. */
  fuentesPrecios: string
}

export function ShoppingListSummary({ pendientes, resumen, total, cobertura, fuentesPrecios }: ShoppingListSummaryProps) {
  return (
    <Card className="mt-4">
      <div className="grid grid-cols-2 items-start gap-x-4 gap-y-1">
        <h2 className="text-h5">Resumen</h2>
        {/* FRESCO-527: was "Total estimado" — read as a running total that
            should drop as items get checked off. It's a fixed snapshot of
            the whole week's menu (computed once in `generate-shopping-list`),
            so the wording says "del menú" to set that expectation.
            FRESCO-1172: the total is the sum of the rows that print a price, NOT the whole menu's cost
            (`/menu` shows that, with average prices for the rest), so it says so and names the coverage. */}
        <p className="text-right text-body-sm uppercase tracking-wide text-tertiary">
          {total !== undefined ? 'Total de los artículos con precio' : 'Total estimado del menú de esta semana'}
        </p>
        <p className="flex items-center gap-1.5 text-body-sm text-tertiary">
          <span className="inline-block size-2 rounded-full bg-primary" aria-hidden="true" />
          {pendientes}
          {' '}
          {pendientes === 1 ? 'artículo pendiente' : 'artículos pendientes'}
        </p>
        <p data-testid="shopping_list_summary_total" className="text-right text-h5 font-heading font-normal text-primary">
          {total !== undefined
            ? formatPrecio(total)
            : `${formatImporte(resumen.coste_estimado_min)}–${formatPrecio(resumen.coste_estimado_max)}`}
        </p>
      </div>
      {total !== undefined && (
        <p data-testid="shopping_list_price_coverage" className="mt-1 text-right text-body-sm text-tertiary">
          {cobertura.conPrecio}
          {' '}
          de
          {' '}
          {cobertura.articulos}
          {' '}
          {cobertura.articulos === 1 ? 'artículo' : 'artículos'}
          {' '}
          con precio
        </p>
      )}
      {/* FRESCO-790 (A6-P2): every price here is an indication, not an offer.
          The chains are read from the data, so a chain switched off in the
          registry (ADR-0037) disappears from this line too. */}
      <p data-testid="shopping_list_price_disclaimer" className="mt-3 text-body-sm text-tertiary">
        {fuentesPrecios
          ? `Precios orientativos de ${fuentesPrecios}, con la fecha en que se observaron junto a cada artículo. Pueden variar en tienda.`
          : 'Precios orientativos. Pueden variar en tienda.'}
      </p>
      {/* FRESCO-971 (UX-20): why only some rows carry the cart icon. */}
      {fuentesPrecios && (
        <p data-testid="shopping_list_cart_hint" className="mt-1 text-body-sm text-tertiary">
          El icono del carrito abre el artículo en la web del súper. Solo aparece en los artículos que hemos encontrado allí.
        </p>
      )}
    </Card>
  );
}
