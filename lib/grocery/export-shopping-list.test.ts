import type { ShoppingListPasillo } from '@/lib/api/types';
import { describe, expect, it } from 'bun:test';
import { formatShoppingListAsCsv, formatShoppingListAsText, SUPERMARKET_LINKS } from './export-shopping-list';

function pasillo(overrides: Partial<ShoppingListPasillo> = {}): ShoppingListPasillo {
  return {
    nombre: 'Frutas y verduras',
    orden: 1,
    items: [{ nombre: 'tomate', cantidad: 3, unidad: 'unidades', comprado: false }],
    ...overrides,
  };
}

describe('formatShoppingListAsText (FRESCO-345)', () => {
  it('formats a single aisle with a single item', () => {
    const text = formatShoppingListAsText([pasillo()]);
    expect(text).toBe('FRUTAS Y VERDURAS\n- 3 unidades Tomate');
  });

  it('formats multiple aisles separated by a blank line', () => {
    const text = formatShoppingListAsText([
      pasillo(),
      pasillo({
        nombre: 'Lácteos y huevos',
        items: [{ nombre: 'leche', cantidad: 2, unidad: 'l', comprado: true }],
      }),
    ]);

    expect(text).toBe(
      'FRUTAS Y VERDURAS\n- 3 unidades Tomate\n\nLÁCTEOS Y HUEVOS\n- 2 l Leche',
    );
  });

  it('singularizes "unidades" to "unidad" when cantidad is 1', () => {
    const text = formatShoppingListAsText([
      pasillo({ items: [{ nombre: 'huevo', cantidad: 1, unidad: 'unidades', comprado: false }] }),
    ]);
    expect(text).toContain('1 unidad Huevo');
  });

  it('returns an explicit message for an empty list, never a blank string', () => {
    expect(formatShoppingListAsText([])).toBe('Lista de la compra vacía.');
  });
});

describe('formatShoppingListAsCsv (FRESCO-345)', () => {
  it('emits header + one row per item, comprado as Sí/No', () => {
    const csv = formatShoppingListAsCsv([
      pasillo({
        items: [
          { nombre: 'tomate', cantidad: 3, unidad: 'unidades', comprado: false },
          { nombre: 'leche', cantidad: 2, unidad: 'l', comprado: true },
        ],
      }),
    ]);

    const lines = csv.split('\n');
    expect(lines[0]).toBe('Pasillo,Artículo,Cantidad,Unidad,Comprado');
    expect(lines[1]).toBe('Frutas y verduras,Tomate,3,unidades,No');
    expect(lines[2]).toBe('Frutas y verduras,Leche,2,l,Sí');
  });

  it('escapes a comma inside an ingredient name per RFC-4180', () => {
    const csv = formatShoppingListAsCsv([
      pasillo({ items: [{ nombre: 'salsa, especial', cantidad: 1, unidad: 'botes', comprado: false }] }),
    ]);
    expect(csv).toContain('"Salsa, especial"');
  });

  it('escapes a double quote inside an ingredient name by doubling it', () => {
    const csv = formatShoppingListAsCsv([
      pasillo({ items: [{ nombre: 'queso "curado"', cantidad: 1, unidad: 'unidades', comprado: false }] }),
    ]);
    expect(csv).toContain('"Queso ""curado"""');
  });

  it('emits only the header for an empty list', () => {
    expect(formatShoppingListAsCsv([])).toBe('Pasillo,Artículo,Cantidad,Unidad,Comprado');
  });

  it('singularizes "unidades" to "unidad" when cantidad is 1', () => {
    const csv = formatShoppingListAsCsv([
      pasillo({ items: [{ nombre: 'huevo', cantidad: 1, unidad: 'unidades', comprado: false }] }),
    ]);
    expect(csv).toContain('1,unidad,');
  });
});

describe('SUPERMARKET_LINKS (FRESCO-345)', () => {
  it('has no query params or tracking, per the Out-of-Scope carve-out', () => {
    for (const link of Object.values(SUPERMARKET_LINKS)) {
      expect(link.url).not.toContain('?');
      expect(link.url).toMatch(/^https:\/\/www\.[a-z]+\.es$/);
    }
  });
});
