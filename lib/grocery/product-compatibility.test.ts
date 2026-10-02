import type { PerfilCompra } from './product-compatibility';
import { describe, expect, test } from 'bun:test';
import { mapShoppingListItem } from './map-item';
import { esProductoCompatible, nombreProductoDesdeUrl, perfilCompraDesde } from './product-compatibility';

/**
 * FRESCO-826 — tables by diet and by allergen. Product names are the real
 * ones the generated Mercadona and Consum catalogs link today (read from their
 * URL slugs), so a catalog refresh that changes a product shows up here.
 */

describe('esProductoCompatible — diet table (real catalog products)', () => {
  const casos: { dieta: string, perfil: PerfilCompra, ingrediente: string, producto: string, compatible: boolean }[] = [
    { dieta: 'vegano', perfil: { vegano: true }, ingrediente: 'caldo', producto: 'caldo pollo hacendado brick', compatible: false },
    { dieta: 'vegano', perfil: { vegano: true }, ingrediente: 'caldo', producto: 'caldo verduras brick', compatible: true },
    { dieta: 'vegano', perfil: { vegano: true }, ingrediente: 'cacahuetes', producto: 'cacahuetes con miel', compatible: false },
    { dieta: 'vegano', perfil: { vegano: true }, ingrediente: 'tofu', producto: 'tofu firme frias paquete', compatible: true },
    { dieta: 'vegetariano', perfil: { vegetariano: true }, ingrediente: 'caldo', producto: 'caldo pollo hacendado brick', compatible: false },
    { dieta: 'vegetariano', perfil: { vegetariano: true }, ingrediente: 'cacahuetes', producto: 'cacahuetes con miel', compatible: true },
    { dieta: 'vegetariano', perfil: { vegetariano: true }, ingrediente: 'queso', producto: 'queso cottage valblu tarrina', compatible: true },
    { dieta: 'halal', perfil: { halal: true }, ingrediente: 'tocino', producto: 'tocino cerdo paquete', compatible: false },
    { dieta: 'halal', perfil: { halal: true }, ingrediente: 'vino blanco', producto: 'vino blanco don simon brick', compatible: true },
    { dieta: 'halal', perfil: { halal: true }, ingrediente: 'pasta', producto: 'pasta fusilli armando paquete', compatible: true },
    { dieta: 'halal', perfil: { halal: true }, ingrediente: 'caldo', producto: 'caldo mixta brick', compatible: false },
    { dieta: 'sin gluten', perfil: { sinGluten: true }, ingrediente: 'avena', producto: 'avena molida hacendado paquete', compatible: true },
    { dieta: 'sin gluten', perfil: { sinGluten: true }, ingrediente: 'tahini', producto: 'pasta sesamo tahini hacendado tarro', compatible: false },
    { dieta: 'sin lactosa', perfil: { sinLactosa: true }, ingrediente: 'leche', producto: 'leche entera hacendado brick', compatible: true },
  ];

  for (const { dieta, perfil, ingrediente, producto, compatible } of casos) {
    test(`${dieta}: ${producto} for "${ingrediente}" is ${compatible ? 'compatible' : 'incompatible'}`, () => {
      expect(esProductoCompatible(ingrediente, producto, perfil)).toBe(compatible);
    });
  }
});

describe('esProductoCompatible — allergen table', () => {
  const casos: { alergeno: string, ingrediente: string, producto: string, compatible: boolean }[] = [
    { alergeno: 'cacahuetes', ingrediente: 'calabaza', producto: 'calabaza cacahuete cortada trozos bandeja', compatible: false },
    { alergeno: 'sesamo', ingrediente: 'tahini', producto: 'crema de sesamo tahini tarro', compatible: false },
    { alergeno: 'sesamo', ingrediente: 'avena', producto: 'avena molida hacendado paquete', compatible: true },
    { alergeno: 'sesamo', ingrediente: 'pasta', producto: 'pasta con sesamo paquete', compatible: false },
    { alergeno: 'soja', ingrediente: 'salsa', producto: 'salsa soja hacendado botella', compatible: false },
    { alergeno: 'frutos_de_cascara', ingrediente: 'avena', producto: 'avena con almendras', compatible: false },
    { alergeno: 'pescado', ingrediente: 'caldo', producto: 'caldo pescado brick', compatible: false },
    { alergeno: 'crustaceos', ingrediente: 'arroz', producto: 'arroz con gambas', compatible: false },
    { alergeno: 'moluscos', ingrediente: 'arroz', producto: 'arroz con calamares', compatible: false },
    { alergeno: 'sulfitos', ingrediente: 'salsa', producto: 'salsa al vino', compatible: false },
    { alergeno: 'apio', ingrediente: 'caldo', producto: 'caldo con apio', compatible: false },
    { alergeno: 'huevo', ingrediente: 'pasta', producto: 'pasta con huevo', compatible: false },
    { alergeno: 'lactosa', ingrediente: 'leche', producto: 'leche entera hacendado brick', compatible: true },
    { alergeno: 'lactosa', ingrediente: 'bebida', producto: 'bebida con leche', compatible: false },
    { alergeno: 'gluten', ingrediente: 'avena', producto: 'avena molida hacendado paquete', compatible: true },
    { alergeno: 'gluten', ingrediente: 'cereales', producto: 'cereales con trigo', compatible: false },
  ];

  for (const { alergeno, ingrediente, producto, compatible } of casos) {
    test(`${alergeno}: ${producto} for "${ingrediente}" is ${compatible ? 'compatible' : 'incompatible'}`, () => {
      expect(esProductoCompatible(ingrediente, producto, { alergenos: [alergeno] })).toBe(compatible);
    });
  }
});

describe('esProductoCompatible — edge rules', () => {
  test('no profile means compatible', () => {
    expect(esProductoCompatible('caldo', 'caldo pollo hacendado brick', undefined)).toBe(true);
  });

  test('a profile with no active restriction means compatible', () => {
    expect(esProductoCompatible('caldo', 'caldo pollo hacendado brick', { vegano: false, alergenos: [] })).toBe(true);
  });

  test('an unreadable product name means compatible (nothing to judge)', () => {
    expect(esProductoCompatible('caldo', '  ', { vegano: true })).toBe(true);
  });

  test('a word the ingredient itself names is not held against the product', () => {
    expect(esProductoCompatible('leche de almendra', 'leche de almendra sin azucar', { vegano: true })).toBe(true);
  });

  test('a "sin lactosa" product is compatible with a lactose restriction', () => {
    expect(esProductoCompatible('leche', 'leche entera sin lactosa', { sinLactosa: true, alergenos: ['lactosa'] })).toBe(true);
  });

  test('a "vegetal" product is compatible with a vegan profile', () => {
    expect(esProductoCompatible('hamburguesa', 'hamburguesa vegetal', { vegano: true })).toBe(true);
  });

  test('matches plural forms of the flagged word', () => {
    expect(esProductoCompatible('arroz', 'arroz con gambas', { alergenos: ['crustaceos'] })).toBe(false);
    expect(esProductoCompatible('arroz', 'arroz con langostinos', { alergenos: ['crustaceos'] })).toBe(false);
  });

  test('several restrictions at once: any one violation makes it incompatible', () => {
    const perfil: PerfilCompra = { vegetariano: true, alergenos: ['cacahuetes'] };

    expect(esProductoCompatible('salsa', 'salsa cacahuete', perfil)).toBe(false);
    expect(esProductoCompatible('salsa', 'salsa tomate', perfil)).toBe(true);
  });
});

describe('perfilCompraDesde / nombreProductoDesdeUrl', () => {
  test('maps the stored profile columns and returns undefined without a profile', () => {
    expect(perfilCompraDesde(null)).toBeUndefined();
    expect(perfilCompraDesde({ dieta_vegano: true, dieta_halal: true, alergenos: ['soja'] })).toEqual({
      vegetariano: undefined,
      vegano: true,
      halal: true,
      sinGluten: undefined,
      sinLactosa: undefined,
      sinHuevo: undefined,
      alergenos: ['soja'],
    });
  });

  test('reads the product name from a Mercadona and a Consum URL slug', () => {
    expect(nombreProductoDesdeUrl('https://tienda.mercadona.es/product/4640/aceite-oliva-1o-hacendado-botella')).toBe('aceite oliva 1o hacendado botella');
    expect(nombreProductoDesdeUrl('https://tienda.consum.es/es/p/aceitunas-gordal-con-hueso/7447647')).toBe('aceitunas gordal con hueso');
    expect(nombreProductoDesdeUrl(null)).toBe('');
  });
});

describe('mapShoppingListItem with a profile (real catalogs)', () => {
  const caldo = { nombre: 'caldo', cantidad: 500, unidad: 'ml' };

  test('without a profile the catalog product and price are kept (baseline)', () => {
    expect(mapShoppingListItem(caldo).precios.length).toBeGreaterThan(0);
  });

  test('a vegan or vegetarian profile drops the chicken stock link and price', () => {
    expect(mapShoppingListItem(caldo, { vegano: true }).precios).toEqual([]);
    expect(mapShoppingListItem(caldo, { vegetariano: true }).precios).toEqual([]);
  });

  test('a halal profile drops the pork product but keeps unrelated ones', () => {
    expect(mapShoppingListItem({ nombre: 'tocino', cantidad: 100, unidad: 'g' }, { halal: true }).precios).toEqual([]);
    expect(mapShoppingListItem({ nombre: 'arroz', cantidad: 200, unidad: 'g' }, { halal: true }).precios.length).toBeGreaterThan(0);
  });

  test('a profile with every restriction on still keeps products that name nothing flagged', () => {
    const todo: PerfilCompra = { vegano: true, sinGluten: true, sinLactosa: true, sinHuevo: true, alergenos: ['soja', 'sesamo'] };

    expect(mapShoppingListItem({ nombre: 'aceite de oliva', cantidad: 50, unidad: 'ml' }, todo).precios.length).toBeGreaterThan(0);
  });
});
