import type { ListEnterItemProps } from '@/components/ui/use-list-enter-animation';
import type { ShoppingListItem } from '@/lib/api/types';
import type { CompraPorItem } from '@/lib/grocery/compra';
import { ShoppingCart } from 'lucide-react';
import { formatUsos, textoAntiguedad } from '@/components/shopping-list/shopping-list-format';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { normalizeNombre } from '@/lib/api/shopping-list';
import { capitalize, cn, formatCantidad, formatPrecio, formatUnidad } from '@/lib/utils';

interface ShoppingListItemRowProps {
  item: ShoppingListItem
  pasilloNombre: string
  pasilloIdx: number
  itemIdx: number
  /** Position across every aisle, so the first-render stagger runs down the whole list. */
  flatIndex: number
  /** Non-null while this exact row is the one that failed its last toggle. */
  shakeNonce: number | null
  nuevosNombres: ReadonlySet<string>
  /** FRESCO-808 — price and supermarket links for this row; absent falls back to the stored estimate with no link. */
  linea: CompraPorItem[string] | undefined
  getItemEnterProps: (key: string, index: number) => ListEnterItemProps
  onToggle: (args: { pasilloIdx: number, itemIdx: number, nextComprado: boolean }) => void
  /** FRESCO-948 — set only in the "Sugerencias para ti" section: shows the "Quitar" action that puts the card back. */
  onRemoveSuggestion?: (args: { pasilloNombre: string, itemNombre: string }) => void
}

/** "2 ud · 3,50 € · precio de hoy": quantity, price (linked or stored estimate) and how old the linked price is. */
function ItemQuantityLine({ item, precio, antiguedad, testIdPrefix }: {
  item: ShoppingListItem
  precio: number | undefined
  antiguedad: string | null
  testIdPrefix: string
}) {
  return (
    <span className="text-body-sm text-tertiary">
      {formatCantidad(item.cantidad)}
      {' '}
      {formatUnidad(item.cantidad, item.unidad)}
      {/* FRESCO-819 (A6-L8): a 0 price means "unknown", never "free" ("Leche 1 l · 0,00€"). */}
      {precio !== undefined && precio > 0 && (
        <>
          {' · '}
          {formatPrecio(precio)}
        </>
      )}
      {antiguedad && (
        <span data-testid={`${testIdPrefix}_precio_antiguedad`}>
          {' · '}
          {antiguedad}
        </span>
      )}
    </span>
  );
}

export function ShoppingListItemRow({ item, pasilloNombre, pasilloIdx, itemIdx, flatIndex, shakeNonce, nuevosNombres, linea, getItemEnterProps, onToggle, onRemoveSuggestion }: ShoppingListItemRowProps) {
  const usosLabel = formatUsos(item.usos);
  // FRESCO-518 / FRESCO-521 / FRESCO-808 — deep-link straight to the matched
  // product page of each chain that priced this row (none: no link, the
  // stored estimate shows). The links come from the server, one per chain;
  // this component names no chain.
  const precio = linea?.precio ?? item.precio_estimado;
  const enlaces = linea?.enlaces ?? [];
  const antiguedad = textoAntiguedad(enlaces[0]?.antiguedadDias ?? null);
  const isShaking = shakeNonce !== null;

  return (
    <li
      className="flex items-center gap-4 p-4"
      {...getItemEnterProps(`${pasilloNombre}::${item.nombre}`, flatIndex)}
    >
      {/* FRESCO-248 — error state shake (12), retargeted from its
          documented `<input>` shape onto this checkbox row: outer
          `.t-input-wrap`, inner `.t-input` shakes when this exact
          [pasilloIdx, itemIdx] is the most recent failing toggle.
          `key` includes `nonce` so a second failure on the SAME
          item forces a fresh element — a className-only toggle
          would produce an identical string on repeat and React
          would skip the DOM write, so the CSS animation would
          never replay (see Decision 1: keyframes autoplay safely
          on fresh mount, same reasoning as the success-check). */}
      <div className="t-input-wrap">
        <div
          key={isShaking ? `shake-${shakeNonce}` : 'idle'}
          className={cn('t-input', isShaking && 'is-shaking')}
        >
          {/* FRESCO-498 — axe `label` violation: this
              checkbox had no accessible name (~40 nodes,
              one per rendered item). `aria-labelledby`
              points at the item-name span below instead
              of duplicating its text into a new hidden
              label. */}
          <Checkbox
            data-testid={`shopping_list_item_${pasilloIdx}_${itemIdx}`}
            checked={item.comprado}
            onChange={e => void onToggle({ pasilloIdx, itemIdx, nextComprado: e.target.checked })}
            aria-labelledby={`shopping_list_item_${pasilloIdx}_${itemIdx}_name`}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <span
            id={`shopping_list_item_${pasilloIdx}_${itemIdx}_name`}
            className={cn(
              // FRESCO-448 (S8): was `text-body-lg`, a class
              // that does not exist — the list's primary
              // content line had no design-token size.
              'truncate text-body-md font-semibold',
              item.comprado ? 'text-tertiary line-through opacity-70' : 'text-text',
            )}
          >
            {capitalize(item.nombre)}
          </span>
          {/* FRESCO-194 — flagged when this item wasn't on
              last week's list. Hidden once bought so a
              struck-through row doesn't shout "Nuevo".
              FRESCO-440 — hairline chip, no accent fill (a
              "new item" badge is decoration, not a CTA). */}
          {!item.comprado && nuevosNombres.has(normalizeNombre(item.nombre)) && (
            <span
              data-testid={`shopping_list_item_${pasilloIdx}_${itemIdx}_nuevo`}
              className="shrink-0 rounded-full border border-border px-2 py-0.5 text-body-sm uppercase tracking-wide text-tertiary"
            >
              Nuevo
            </span>
          )}
          {/* FRESCO-948 — tells the person this row is the item they just added
              from a suggestion. Hairline chip like "Nuevo"; 13px, not the 11px
              caption (FRESCO-940 floor). */}
          {item.origen === 'sugerencia' && (
            <span
              data-testid={`shopping_list_item_${pasilloIdx}_${itemIdx}_anadido`}
              className="shrink-0 rounded-full border border-border px-2 py-0.5 text-body-sm text-tertiary"
            >
              Añadido
            </span>
          )}
        </div>
        <ItemQuantityLine
          item={item}
          precio={precio}
          antiguedad={antiguedad}
          testIdPrefix={`shopping_list_item_${pasilloIdx}_${itemIdx}`}
        />
        {/* FRESCO-212: which dish(es) + day(s) need this
            ingredient — absent for lists persisted before
            this field existed, and for suggestion-added
            items (no meal-plan provenance). */}
        {usosLabel && (
          <span
            className="line-clamp-2 text-body-sm text-tertiary"
            title={usosLabel}
          >
            {usosLabel}
          </span>
        )}
      </div>
      {!item.comprado && enlaces.map(enlace => (
        <a
          key={enlace.cadena}
          href={enlace.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${capitalize(item.nombre)} en ${enlace.nombreCadena}`}
          title={`Abrir ${capitalize(item.nombre)} en ${enlace.nombreCadena}`}
          data-testid={`shopping_list_item_${pasilloIdx}_${itemIdx}_${enlace.cadena}_link`}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 text-tertiary transition-colors hover:text-text"
        >
          {/* FRESCO-819 (A6-L10): the link is the 44px+ tap target; the bordered chip stays the same size inside it. */}
          <span className="rounded-lg border border-border p-1.5">
            <ShoppingCart className="size-4" aria-hidden="true" />
          </span>
          {/* FRESCO-971 (UX-20): the cart opens this row's product at the chain. Named from sm up;
              below that the row has no room, so title/aria-label carry it and the summary explains it. */}
          <span className="hidden text-body-sm sm:inline" aria-hidden="true">
            {enlace.nombreCadena}
          </span>
        </a>
      ))}
      {/* FRESCO-948 — undo of "Añadir": the card goes back to the carousel. */}
      {onRemoveSuggestion && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[44px] shrink-0"
          aria-label={`Quitar ${capitalize(item.nombre)} de la lista`}
          data-testid={`shopping_list_item_${pasilloIdx}_${itemIdx}_quitar`}
          onClick={() => onRemoveSuggestion({ pasilloNombre, itemNombre: item.nombre })}
        >
          Quitar
        </Button>
      )}
    </li>
  );
}
