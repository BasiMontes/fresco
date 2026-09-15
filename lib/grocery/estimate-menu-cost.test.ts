import type { DiaSemana, TipoPlato } from '@/lib/api/types';
import type { MenuGrid } from '@/lib/calendar/apply-slot-swap';
import { describe, expect, test } from 'bun:test';
import { makeFixtureRecipe } from '@/lib/fixtures/recipe';
import {
  consolidateRecipeIngredients,
  estimateMenuCost,
  packPrice,
  parseFormatoReferencia,
  PRECIO_MEDIO_POR_UNIDAD,
} from './estimate-menu-cost';
import { INGREDIENT_DICTIONARY } from './ingredient-dictionary';
import { mapShoppingListItem } from './map-item';

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const TIPOS: TipoPlato[] = ['desayuno', 'comida', 'cena'];

/** 21-cell menu, every slot `null` — tests override the specific cells they need. */
function emptyMenu(): MenuGrid {
  const menu = {} as MenuGrid;
  for (const dia of DIAS) {
    const dayGrid = {} as MenuGrid[DiaSemana];
    for (const tipo of TIPOS) { dayGrid[tipo] = null; }
    menu[dia] = dayGrid;
  }
  return menu;
}

/** `meta` fixture with an explicit `raciones` — tests scale by `numPersonas / raciones`. */
function metaConRaciones(raciones: number) {
  return {
    tiempo_prep_min: 5,
    tiempo_coccion_min: 10,
    tiempo_total_min: 15,
    raciones,
    coste_estimado: 'bajo' as const,
    dificultad: 'facil' as const,
  };
}

describe('parseFormatoReferencia', () => {
  test('parsea "100 g" (número + unidad)', () => {
    expect(parseFormatoReferencia('100 g')).toEqual({ cantidad: 100, unidad: 'g' });
  });

  test('parsea "kg" sin número al frente -> cantidad 1', () => {
    expect(parseFormatoReferencia('kg')).toEqual({ cantidad: 1, unidad: 'kg' });
  });

  test('parsea "L" -> unidad en minúsculas', () => {
    expect(parseFormatoReferencia('L')).toEqual({ cantidad: 1, unidad: 'l' });
  });

  test('formato no reconocido (Risk 2) nunca lanza y cae a un fallback seguro', () => {
    expect(() => parseFormatoReferencia('???')).not.toThrow();
    const result = parseFormatoReferencia('???');
    expect(result.cantidad).toBe(1);
    expect(typeof result.unidad).toBe('string');
  });
});

describe('packPrice', () => {
  test('ingrediente con match real de Mercadona (aceite de oliva) convierte precioReferencia (por L) al precio del envase de 1000 ml', () => {
    const item = mapShoppingListItem({ nombre: 'aceite de oliva', cantidad: 50, unidad: 'ml' });
    expect(item.origenEnvase).toBe('mercadona');
    // precioReferencia 3.9 €/L, envase 1000 ml = 1 L -> 3.9 * (1000/1000) = 3.90 €.
    expect(packPrice(item)).toBeCloseTo(3.9, 2);
  });

  test('ingrediente origenEnvase estimado (cebolla) usa el precio medio genérico por unidad', () => {
    const item = mapShoppingListItem({ nombre: 'cebolla', cantidad: 1, unidad: 'unidades' });
    expect(item.origenEnvase).toBe('estimado');
    // envase {1, 'unidad'} -> PRECIO_MEDIO_POR_UNIDAD['unidad'] no existe -> fallback .unidades = 0.8.
    expect(packPrice(item)).toBeCloseTo(0.8, 2);
  });

  test('ingrediente totalmente ausente del diccionario no lanza y no es NaN', () => {
    const item = mapShoppingListItem({ nombre: 'ingrediente-inexistente-xyz', cantidad: 3, unidad: 'unidades' });
    expect(item.origenEnvase).toBe('estimado');
    const price = packPrice(item);
    expect(Number.isNaN(price)).toBe(false);
    expect(Number.isFinite(price)).toBe(true);
  });

  test('formatoReferencia no reconocido en un item mercadona cae al fallback genérico en vez de lanzar', () => {
    const item = {
      nombreOriginal: 'ingrediente raro',
      productoCanonico: 'ingrediente raro',
      terminoBusqueda: 'ingrediente raro',
      pasillo: null,
      cantidadNormalizada: 100,
      unidadVenta: 'g',
      envasesEstimados: 1,
      confianza: 'baja' as const,
      origenEnvase: 'mercadona' as const,
      precioMercadona: { precioReferencia: 5, formatoReferencia: '???' },
      mercadonaUrl: 'https://tienda.mercadona.es/product/1/ingrediente-raro',
      precioConsum: null,
      consumUrl: null,
    };

    const price = packPrice(item);
    expect(Number.isFinite(price)).toBe(true);
    expect(Number.isNaN(price)).toBe(false);
  });

  // Adversarial review finding #2: "lentejas" es el único dictionary entry
  // con `formatoReferencia: "ud"` — ni masa ni volumen, así que
  // `convertirUnidad` no lo reconoce. Antes del fix, esto descartaba un
  // precio real de catálogo (€4) en favor del fallback genérico (€2.91).
  test('ingrediente con formatoReferencia "ud" (lentejas) usa el precio real de catálogo, no el fallback genérico', () => {
    const item = mapShoppingListItem({ nombre: 'lentejas', cantidad: 300, unidad: 'g' });
    expect(item.origenEnvase).toBe('mercadona');

    // precioReferencia 4 €/ud, el envase de 485 g ES esa "ud" -> precio de paquete = 4 €.
    expect(packPrice(item)).toBeCloseTo(4, 2);

    // El fallback genérico (envase 485 g * PRECIO_MEDIO_POR_UNIDAD.g) sería un número muy distinto (2.91 €).
    const fallbackGenerico = PRECIO_MEDIO_POR_UNIDAD.g * 485;
    expect(packPrice(item)).not.toBeCloseTo(fallbackGenerico, 2);
  });

  // Guarda de regresión (sugerencia del reviewer): escanea TODOS los tokens
  // de `formatoReferencia` que existen hoy en el diccionario generado y
  // asegura que ninguno cae silenciosamente al fallback genérico para un
  // ingrediente con match real de Mercadona. Si una futura regeneración del
  // diccionario introduce un token nuevo no reconocido ni por `convertirUnidad`
  // ni por `esUnidadDeConteo`, este test lo detecta sin que nadie tenga que
  // pensar en ello.
  test('cada token distinto de formatoReferencia presente en el diccionario produce un precio real, no el fallback genérico', () => {
    const claveDeEjemploPorToken = new Map<string, string>();
    for (const entry of Object.values(INGREDIENT_DICTIONARY)) {
      if (entry.origenEnvase !== 'mercadona' || !entry.precioMercadona) { continue; }
      const { unidad } = parseFormatoReferencia(entry.precioMercadona.formatoReferencia);
      if (!claveDeEjemploPorToken.has(unidad)) { claveDeEjemploPorToken.set(unidad, entry.clave); }
    }

    // Sanity: si esto es 0, el propio test está roto (diccionario vacío o sin entradas mercadona).
    expect(claveDeEjemploPorToken.size).toBeGreaterThan(0);

    for (const clave of claveDeEjemploPorToken.values()) {
      const entry = INGREDIENT_DICTIONARY[clave];
      const item = mapShoppingListItem({
        nombre: entry.canonico,
        cantidad: entry.porcionReceta.cantidad,
        unidad: entry.porcionReceta.unidad,
      });
      expect(item.origenEnvase).toBe('mercadona');

      const price = packPrice(item);
      expect(Number.isFinite(price)).toBe(true);
      expect(Number.isNaN(price)).toBe(false);

      const fallbackGenerico = (PRECIO_MEDIO_POR_UNIDAD[entry.envaseVenta.unidad] ?? PRECIO_MEDIO_POR_UNIDAD.unidades) * entry.envaseVenta.cantidad;
      expect(price).not.toBeCloseTo(fallbackGenerico, 2);
    }
  });
});

describe('consolidateRecipeIngredients', () => {
  test('slot vacío (recipe: null) se salta, no cuenta', () => {
    const menu = emptyMenu();
    expect(consolidateRecipeIngredients(menu, 4)).toEqual([]);
  });

  test('receta sin ingredientes_principales (null) no aporta nada', () => {
    const menu = emptyMenu();
    menu.sabado.desayuno = makeFixtureRecipe({ nombre: 'Receta sin ingredientes', ingredientes_principales: null });
    expect(consolidateRecipeIngredients(menu, 4)).toEqual([]);
  });

  test('el mismo ingrediente en 2+ recetas de la semana se consolida en una sola entrada, con la cantidad TOTAL', () => {
    const menu = emptyMenu();
    menu.lunes.comida = makeFixtureRecipe({
      nombre: 'Receta A',
      ingredientes_principales: ['aceite de oliva'],
      meta: metaConRaciones(4),
    });
    menu.miercoles.cena = makeFixtureRecipe({
      nombre: 'Receta B',
      ingredientes_principales: ['aceite de oliva'],
      meta: metaConRaciones(4),
    });

    const inputs = consolidateRecipeIngredients(menu, 4);
    const aceite = inputs.find(i => i.nombre === 'aceite de oliva');

    expect(inputs.length).toBe(1);
    expect(aceite?.cantidad).toBeCloseTo(100, 5); // 50 ml + 50 ml, no dos entradas de 50 ml sueltas
    expect(aceite?.usos?.length).toBe(2);
  });

  test('recipe.meta.raciones en 0 cae al fallback de 4 raciones, sin Infinity/NaN', () => {
    const menu = emptyMenu();
    menu.jueves.desayuno = makeFixtureRecipe({
      nombre: 'Receta sin raciones válidas',
      ingredientes_principales: ['aceite de oliva'],
      meta: metaConRaciones(0),
    });

    const inputs = consolidateRecipeIngredients(menu, 4);
    const aceite = inputs.find(i => i.nombre === 'aceite de oliva');

    expect(aceite).toBeDefined();
    expect(Number.isFinite(aceite?.cantidad)).toBe(true);
    // raciones 0 -> fallback 4; numPersonas 4 -> factor 1, igual que el caso base (50 ml).
    expect(aceite?.cantidad).toBeCloseTo(50, 5);
  });

  // Adversarial review finding #1: el nombre de la receta lleva contexto
  // ("ahumado") que `recoverFromRecipeContext` (FRESCO-488) remapea a un
  // dictionary entry MÁS específico ("salmón ahumado", porcionReceta 150 g)
  // que el genérico "salmón" (porcionReceta 400 g). La cantidad consolidada
  // debe salir de la porción del entry RECUPERADO, no del genérico.
  test('un ingrediente genérico con contexto de receta más específico consolida la cantidad del entry RECUPERADO, no del directo', () => {
    const menu = emptyMenu();
    menu.lunes.desayuno = makeFixtureRecipe({
      nombre: 'Tostada con salmon ahumado y aguacate',
      ingredientes_principales: ['salmon'],
      meta: metaConRaciones(4),
    });

    const inputs = consolidateRecipeIngredients(menu, 4);

    // Se buckeó bajo el producto canónico recuperado ("salmón ahumado"), no bajo "salmón" genérico.
    expect(inputs.find(i => i.nombre === 'salmón')).toBeUndefined();
    const salmonAhumado = inputs.find(i => i.nombre === 'salmón ahumado');
    expect(salmonAhumado).toBeDefined();
    // porcionReceta de "salmón ahumado" es 150 g (NO los 400 g del "salmón" genérico) * factor 1.
    expect(salmonAhumado?.cantidad).toBeCloseTo(150, 5);
    expect(salmonAhumado?.unidad).toBe('g');
  });

  // Compounding: el MISMO ingrediente genérico aparece dos veces en la misma
  // semana — una vez SIN contexto específico (debe quedarse genérico) y otra
  // vez CON contexto (debe recuperar) — no deben mezclarse en un solo bucket.
  test('el mismo ingrediente genérico sin contexto y con contexto en la misma semana NO se mezclan en un solo bucket', () => {
    const menu = emptyMenu();
    menu.lunes.comida = makeFixtureRecipe({
      nombre: 'Salmón a la plancha',
      ingredientes_principales: ['salmon'],
      meta: metaConRaciones(4),
    });
    menu.martes.desayuno = makeFixtureRecipe({
      nombre: 'Tostada con salmon ahumado y aguacate',
      ingredientes_principales: ['salmon'],
      meta: metaConRaciones(4),
    });

    const inputs = consolidateRecipeIngredients(menu, 4);

    expect(inputs.length).toBe(2);

    const salmonGenerico = inputs.find(i => i.nombre === 'salmón');
    expect(salmonGenerico).toBeDefined();
    expect(salmonGenerico?.cantidad).toBeCloseTo(400, 5);
    expect(salmonGenerico?.usos?.length).toBe(1);

    const salmonAhumado = inputs.find(i => i.nombre === 'salmón ahumado');
    expect(salmonAhumado).toBeDefined();
    expect(salmonAhumado?.cantidad).toBeCloseTo(150, 5);
    expect(salmonAhumado?.usos?.length).toBe(1);
  });
});

describe('estimateMenuCost', () => {
  test('menú con los 21 slots vacíos devuelve coste 0', () => {
    expect(estimateMenuCost(emptyMenu(), 4)).toBe(0);
  });

  test('un ingrediente con match real de Mercadona (aceite de oliva) produce el total esperado a mano', () => {
    const menu = emptyMenu();
    menu.lunes.comida = makeFixtureRecipe({
      nombre: 'Receta con aceite',
      ingredientes_principales: ['aceite de oliva'],
      meta: metaConRaciones(4),
    });

    // porcionReceta 50 ml, factor 4/4 = 1 -> 50 ml; envase 1000 ml -> 1 paquete;
    // precioReferencia 3.9 €/L -> 3.9 * (1000 ml -> 1 L / 1) = 3.90 €.
    expect(estimateMenuCost(menu, 4)).toBe(3.9);
  });

  test('el mismo ingrediente en 2+ recetas no compra 2 paquetes si 1 basta (dedupe real)', () => {
    const menu = emptyMenu();
    menu.lunes.comida = makeFixtureRecipe({
      nombre: 'Receta A',
      ingredientes_principales: ['aceite de oliva'],
      meta: metaConRaciones(4),
    });
    menu.miercoles.cena = makeFixtureRecipe({
      nombre: 'Receta B',
      ingredientes_principales: ['aceite de oliva'],
      meta: metaConRaciones(4),
    });

    // 50 ml + 50 ml = 100 ml consolidados -> sigue cabiendo en 1 envase de 1000 ml (3.90 €).
    // Sin consolidar serían 2 envases sueltos: 2 x 3.90 € = 7.80 €.
    expect(estimateMenuCost(menu, 4)).toBe(3.9);
  });

  test('recipe.meta.raciones en 0 no revienta con Infinity, cae al fallback de 4', () => {
    const menu = emptyMenu();
    menu.jueves.desayuno = makeFixtureRecipe({
      nombre: 'Receta sin raciones válidas',
      ingredientes_principales: ['aceite de oliva'],
      meta: metaConRaciones(0),
    });

    const total = estimateMenuCost(menu, 4);
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBe(3.9); // raciones 0 -> fallback 4, numPersonas 4 -> factor 1, igual que el caso base
  });

  test('ingrediente totalmente ausente del diccionario no lanza y el total no es NaN', () => {
    const menu = emptyMenu();
    menu.martes.cena = makeFixtureRecipe({
      nombre: 'Receta con ingrediente inventado',
      ingredientes_principales: ['ingrediente-inexistente-xyz'],
      meta: metaConRaciones(4),
    });

    const total = estimateMenuCost(menu, 4);
    expect(Number.isNaN(total)).toBe(false);
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBeGreaterThan(0);
  });

  test('numPersonas distinto de 4 escala la cantidad y, en el límite, el número de paquetes', () => {
    const menu = emptyMenu();
    menu.viernes.comida = makeFixtureRecipe({
      nombre: 'Receta con garbanzos',
      ingredientes_principales: ['garbanzos'],
      meta: metaConRaciones(4),
    });

    // garbanzos: porcionReceta 400 g, envase 420 g, precioReferencia 3.215 €/kg.
    // factor 4/4=1 -> 400 g -> 1 paquete. factor 8/4=2 -> 800 g -> 2 paquetes (cruza el límite).
    const total4 = estimateMenuCost(menu, 4);
    const total8 = estimateMenuCost(menu, 8);

    const precioPorPaquete = 3.215 * (420 / 1000); // 420 g convertidos a kg
    expect(total4).toBeCloseTo(Math.round(precioPorPaquete * 100) / 100, 2);
    expect(total8).toBeCloseTo(Math.round(precioPorPaquete * 2 * 100) / 100, 2);
    // El salto de 1 a 2 paquetes es más que el simple doblado de cantidad (400g -> 800g sin cruzar límite escalaría igual).
    expect(total8).toBeCloseTo(total4 * 2, 2);
  });

  // Adversarial review finding #1 — reproducción end-to-end del reviewer:
  // receta "Tostada con salmon ahumado y aguacate", ingredientes_principales
  // ['salmon'], 4 raciones, numPersonas 4.
  //
  // ANTES del fix (bug real, verificado a mano): la cantidad salía del
  // dictionary entry DIRECTO ("salmón", porcionReceta 400 g) pero el precio
  // del RECUPERADO ("salmón ahumado", envase 100 g, 37 €/kg) -> 400 g / 100 g
  // = 4 paquetes * 3.70 € = 14.80 € — precio de dos productos mezclados.
  //
  // DESPUÉS del fix: cantidad y precio salen del MISMO entry recuperado
  // ("salmón ahumado", porcionReceta 150 g) -> 150 g / 100 g = 2 paquetes
  // (ceil) * 3.70 € = 7.40 €.
  test('recuperación de contexto de receta (salmón ahumado) produce el coste correcto, no un blend de dos productos', () => {
    const menu = emptyMenu();
    menu.lunes.desayuno = makeFixtureRecipe({
      nombre: 'Tostada con salmon ahumado y aguacate',
      ingredientes_principales: ['salmon'],
      meta: metaConRaciones(4),
    });

    const total = estimateMenuCost(menu, 4);

    // Precio por paquete de "salmón ahumado": 37 €/kg * (100 g -> 0.1 kg) = 3.70 €.
    const precioPorPaqueteAhumado = 37 * (100 / 1000);
    // Cantidad correcta: porcionReceta del RECUPERADO (150 g) * factor 1 -> ceil(150/100) = 2 paquetes.
    const totalCorrecto = Math.round(precioPorPaqueteAhumado * 2 * 100) / 100;
    expect(totalCorrecto).toBeCloseTo(7.4, 2);
    expect(total).toBeCloseTo(totalCorrecto, 2);

    // El número que producía el bug (cantidad del directo 400g / envase 100g = 4 paquetes * 3.70€) queda descartado.
    const totalBugueado = Math.round(precioPorPaqueteAhumado * 4 * 100) / 100;
    expect(totalBugueado).toBeCloseTo(14.8, 2);
    expect(total).not.toBeCloseTo(totalBugueado, 2);
  });
});
