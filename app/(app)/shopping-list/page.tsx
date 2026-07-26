'use client';

import type { GenerateShoppingListResponse } from '@/lib/api/types';

import { useState } from 'react';
import { Card } from '@/components/ui/card';

/**
 * `/shopping-list` — EPIC-FRESCO-4 (US 4.1/4.2: auto-generated, aisle-grouped
 * shopping list). Mock data shaped exactly like `GenerateShoppingListResponse`
 * (api-contracts.md §2). Item toggling below is local UI state only — the
 * real `comprado` toggle bypasses the Edge Function layer entirely via a
 * direct Supabase `security definer` RPC call (api-contracts.md §3), which
 * needs the backend agent's `lib/supabase/client.ts` to exist first.
 */
const MOCK_SHOPPING_LIST: GenerateShoppingListResponse = {
  shopping_list_id: 'sl_mock_1',
  pasillos: [
    {
      nombre: 'Frutas y verduras',
      orden: 1,
      items: [
        { nombre: 'cebolla', cantidad: 4, unidad: 'unidades', comprado: false },
        { nombre: 'zanahoria', cantidad: 3, unidad: 'unidades', comprado: false },
        { nombre: 'aguacate', cantidad: 2, unidad: 'unidades', comprado: true },
      ],
    },
    {
      nombre: 'Legumbres y cereales',
      orden: 2,
      items: [
        { nombre: 'lentejas', cantidad: 500, unidad: 'g', comprado: false },
        { nombre: 'arroz', cantidad: 500, unidad: 'g', comprado: false },
      ],
    },
    {
      nombre: 'Pescadería',
      orden: 3,
      items: [{ nombre: 'salmón', cantidad: 400, unidad: 'g', comprado: false }],
    },
  ],
  resumen: { total_items: 6, coste_estimado_min: 18, coste_estimado_max: 26, moneda: 'EUR' },
};

export default function ShoppingListPage() {
  const [pasillos, setPasillos] = useState(MOCK_SHOPPING_LIST.pasillos);

  function toggleItem(pasilloIdx: number, itemIdx: number) {
    // TODO: wire to the real `jsonb_set_comprado` Supabase RPC once
    // lib/supabase/client.ts exists (api-contracts.md §3) — local-only for now.
    setPasillos(current =>
      current.map((pasillo, pIdx) =>
        pIdx !== pasilloIdx
          ? pasillo
          : {
              ...pasillo,
              items: pasillo.items.map((item, iIdx) =>
                iIdx !== itemIdx ? item : { ...item, comprado: !item.comprado },
              ),
            },
      ),
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-h2">Lista de la compra</h1>
      <p className="mt-1 text-body-md text-tertiary">
        {MOCK_SHOPPING_LIST.resumen.total_items}
        {' '}
        productos · estimado
        {' '}
        {MOCK_SHOPPING_LIST.resumen.coste_estimado_min}
        –
        {MOCK_SHOPPING_LIST.resumen.coste_estimado_max}
        {' '}
        {MOCK_SHOPPING_LIST.resumen.moneda}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {pasillos.map((pasillo, pasilloIdx) => (
          <Card key={pasillo.nombre}>
            <p className="mb-2 text-label">{pasillo.nombre}</p>
            <ul className="flex flex-col gap-2">
              {pasillo.items.map((item, itemIdx) => (
                <li key={item.nombre} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.comprado}
                    onChange={() => toggleItem(pasilloIdx, itemIdx)}
                    className="size-4 accent-primary"
                  />
                  <span
                    className={`text-body-sm ${item.comprado ? 'text-neutral-500 line-through' : 'text-text'}`}
                  >
                    {item.nombre}
                    {' '}
                    ·
                    {item.cantidad}
                    {' '}
                    {item.unidad}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
