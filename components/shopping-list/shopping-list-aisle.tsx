import type { ListEnterItemProps } from '@/components/ui/use-list-enter-animation';
import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import type { CompraPorItem } from '@/lib/grocery/compra';
import { getPasilloIcon } from '@/components/shopping-list/pasillo-icons';
import { ShoppingListItemRow } from '@/components/shopping-list/shopping-list-item-row';
import { Card } from '@/components/ui/card';
import { claveItemCompra } from '@/lib/grocery/compra';

interface ShoppingListAisleProps {
  pasillo: ShoppingListPersistido['pasillos'][number]
  pasilloIdx: number
  /** Items in every aisle before this one, so row indexes run across the whole list. */
  flatOffset: number
  shakingItem: { pasilloIdx: number, itemIdx: number, nonce: number } | null
  nuevosNombres: ReadonlySet<string>
  compra: CompraPorItem | undefined
  getItemEnterProps: (key: string, index: number) => ListEnterItemProps
  onToggle: (args: { pasilloIdx: number, itemIdx: number, nextComprado: boolean }) => void
}

export function ShoppingListAisle({ pasillo, pasilloIdx, flatOffset, shakingItem, nuevosNombres, compra, getItemEnterProps, onToggle }: ShoppingListAisleProps) {
  const PasilloIcon = getPasilloIcon(pasillo.nombre);

  // FRESCO-948 — items added from "Sugerencias para ti" show in that section, not
  // here. They stay in this aisle's array so `itemIdx` below is still the index the
  // toggle RPC expects; an aisle that holds only those renders nothing.
  if (!pasillo.items.some(item => item.origen !== 'sugerencia')) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 border-b border-border pb-1 text-h6">
        {/* FRESCO-440: hairline box, no accent tint — a section-heading
            adornment is not a CTA. Padding lives on this wrapper span,
            not on the icon itself — size-4 + p-1.5 on the same element
            (border-box) ate into the icon's own fixed box, shrinking the
            visible glyph to ~4px. */}
        <span className="flex shrink-0 items-center justify-center rounded-lg border border-border p-1.5">
          <PasilloIcon className="size-4 text-tertiary" aria-hidden="true" />
        </span>
        {pasillo.nombre}
      </h3>
      <Card className="p-0">
        <ul className="flex flex-col divide-y divide-border">
          {pasillo.items.map((item, itemIdx) => {
            if (item.origen === 'sugerencia') { return null; }
            const isShaking = shakingItem !== null && shakingItem.pasilloIdx === pasilloIdx && shakingItem.itemIdx === itemIdx;
            return (
              <ShoppingListItemRow
                key={item.nombre}
                item={item}
                pasilloNombre={pasillo.nombre}
                pasilloIdx={pasilloIdx}
                itemIdx={itemIdx}
                flatIndex={flatOffset + itemIdx}
                shakeNonce={isShaking ? shakingItem.nonce : null}
                nuevosNombres={nuevosNombres}
                linea={compra?.[claveItemCompra({ pasillo: pasillo.nombre, item: item.nombre })]}
                getItemEnterProps={getItemEnterProps}
                onToggle={onToggle}
              />
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
