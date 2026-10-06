import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import { Card } from '@/components/ui/card';
import { formatPrecio } from '@/lib/utils';

interface ShoppingListSummaryProps {
  pendientes: number
  resumen: ShoppingListPersistido['resumen']
  /** FRESCO-792 — the weekly cost from `costeSemanalEstimado`; absent falls back to the stored range. */
  costeMenu: number | undefined
  /** FRESCO-790 — the chains that priced a row, as the shopper reads them ("Mercadona y Consum"); empty when none did. */
  fuentesPrecios: string
}

export function ShoppingListSummary({ pendientes, resumen, costeMenu, fuentesPrecios }: ShoppingListSummaryProps) {
  return (
    <Card className="mt-4">
      <div className="grid grid-cols-2 items-start gap-x-4 gap-y-1">
        <h2 className="text-h5">Resumen</h2>
        {/* FRESCO-527: was "Total estimado" — read as a running total that
            should drop as items get checked off. It's a fixed snapshot of
            the whole week's menu (computed once in `generate-shopping-list`),
            so the wording says "del menú" to set that expectation. */}
        <p className="text-right text-caption uppercase tracking-wide text-tertiary">Total estimado del menú de esta semana</p>
        <p className="flex items-center gap-1.5 text-body-sm text-tertiary">
          <span className="inline-block size-2 rounded-full bg-primary" aria-hidden="true" />
          {pendientes}
          {' '}
          {pendientes === 1 ? 'artículo pendiente' : 'artículos pendientes'}
        </p>
        <p data-testid="shopping_list_summary_total" className="text-right text-h5 font-heading text-primary">
          {costeMenu !== undefined
            ? formatPrecio(costeMenu)
            : `${resumen.coste_estimado_min.toFixed(2).replace('.', ',')}–${formatPrecio(resumen.coste_estimado_max)}`}
        </p>
      </div>
      {/* FRESCO-790 (A6-P2): every price here is an indication, not an offer.
          The chains are read from the data, so a chain switched off in the
          registry (ADR-0037) disappears from this line too. */}
      <p data-testid="shopping_list_price_disclaimer" className="mt-3 text-caption text-tertiary">
        {fuentesPrecios
          ? `Precios orientativos de ${fuentesPrecios}, con la fecha en que se observaron junto a cada artículo. Pueden variar en tienda.`
          : 'Precios orientativos. Pueden variar en tienda.'}
      </p>
    </Card>
  );
}
