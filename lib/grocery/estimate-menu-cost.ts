import type { GroceryInput, MappedGroceryItem } from './types';
import type { DiaSemana, TipoPlato } from '@/lib/api/types';
import type { MenuGrid } from '@/lib/calendar/apply-slot-swap';
import { normalizeNombre } from '@/lib/text/normalize-nombre';
import { INGREDIENT_DICTIONARY } from './ingredient-dictionary';
import { mapShoppingList } from './map-item';

/**
 * FRESCO-340 — coste estimado del menú semanal.
 *
 * Módulo puro, sin I/O: recorre las 21 celdas de un `MenuGrid`, consolida
 * los ingredientes de cada receta a través de TODA la semana (dedupe real —
 * un ingrediente usado en 3 recetas compra lo que haga falta para el total,
 * no 3 paquetes sueltos) y calcula un único número de coste, artículo a
 * artículo: precio real de catálogo Mercadona cuando existe match
 * (`lib/grocery/`, FRESCO-488/503), precio medio de respaldo para el resto.
 * Nunca un precio final garantizado (Business Rule, refinamiento 2026-09-14).
 *
 * Nunca lanza: cada pieza cae a un valor de respaldo seguro ante un dato
 * inesperado — utilidad pura, fallo silencioso (AGENTS.md §10).
 */

const DIAS: readonly DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const TIPOS: readonly TipoPlato[] = ['desayuno', 'comida', 'cena'];

/** Raciones por defecto cuando la receta no declara `meta.raciones` o declara 0 — nunca dividir por 0. */
const RACIONES_POR_DEFECTO = 4;

/**
 * Parsea un `formatoReferencia` de `precioMercadona` ("100 g" / "kg" / "L")
 * en cantidad+unidad. Sin número al frente → cantidad 1. Nunca lanza: un
 * formato no reconocido cae a `{cantidad: 1, unidad: <string tal cual>}`
 * (Risk 2 del plan) — `packPrice` absorbe ese fallback con su propia tabla
 * genérica en vez de propagar el error.
 */
export function parseFormatoReferencia(formato: string): { cantidad: number, unidad: string } {
  const trimmed = (formato ?? '').trim();
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?)?\s*([a-z]+)$/i);

  if (!match) {
    return { cantidad: 1, unidad: trimmed.toLowerCase() };
  }

  const [, cantidadStr, unidadRaw] = match;
  const cantidad = cantidadStr ? Number.parseFloat(cantidadStr.replace(',', '.')) : 1;

  return {
    cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
    unidad: unidadRaw.toLowerCase(),
  };
}

/**
 * Tabla de precio medio de respaldo por tipo de unidad. Valores calcados 1:1
 * de `supabase/functions/generate-shopping-list/aisle-pricing.ts`'s
 * `PRICE_PER_UNIT_TYPE` — ESA tabla es la fuente de verdad; esta es una
 * duplicación deliberada (mismo precedente que `normalizeNombre` entre
 * `lib/text/` y `supabase/functions/_shared/`). Actualizar ambas si una cambia.
 */
export const PRECIO_MEDIO_POR_UNIDAD: Record<string, number> = {
  unidades: 0.8,
  g: 0.006,
  kg: 6,
  ml: 0.004,
  l: 4,
  latas: 1.4,
  botes: 2,
  rebanadas: 0.12,
  dientes: 0.04,
  cucharadas: 0.08,
};

/** g↔kg, ml↔L — para convertir `envaseVenta` a la unidad de `formatoReferencia`. */
const MASA_EN_GRAMOS: Record<string, number> = { g: 1, kg: 1000 };
const VOLUMEN_EN_ML: Record<string, number> = { ml: 1, l: 1000 };

/** Convierte `cantidad` de `desde` a `hasta` cuando ambas están en la misma familia (masa o volumen). `null` si no se puede — nunca lanza. */
function convertirUnidad(cantidad: number, desde: string, hasta: string): number | null {
  const from = desde.toLowerCase();
  const to = hasta.toLowerCase();

  if (from === to) { return cantidad; }
  if (from in MASA_EN_GRAMOS && to in MASA_EN_GRAMOS) { return (cantidad * MASA_EN_GRAMOS[from]) / MASA_EN_GRAMOS[to]; }
  if (from in VOLUMEN_EN_ML && to in VOLUMEN_EN_ML) { return (cantidad * VOLUMEN_EN_ML[from]) / VOLUMEN_EN_ML[to]; }
  return null;
}

/**
 * El paquete real (`envaseVenta`) que respalda un `MappedGroceryItem` no es
 * hoy un campo del tipo — `lib/grocery/types.ts` todavía no lo expone. Esa
 * extensión aditiva es el Step 1 del plan de esta historia, deliberadamente
 * bucketed en PR2 (wiring de UI) por la decisión de PR encadenado, para que
 * este módulo (PR1) quede autocontenido sin tocar `types.ts`/`map-item.ts`.
 *
 * Se re-deriva aquí desde `INGREDIENT_DICTIONARY`, keyed por
 * `productoCanonico` — que SIEMPRE es `entry.canonico` de la MISMA entrada
 * que `mapShoppingListItem` resolvió internamente (match directo o
 * recuperación de contexto de receta), así que el resultado es idéntico al
 * que produciría leer `item.envaseVenta` directamente una vez exista el
 * campo. Ingrediente sin match en el diccionario → mismo fallback que
 * usaría la rama unknown de `mapShoppingListItem` una vez migrada
 * (`{cantidad: 1, unidad: unidadVenta}`).
 */
function resolveEnvaseVenta(item: MappedGroceryItem): { cantidad: number, unidad: string } {
  const entry = INGREDIENT_DICTIONARY[normalizeNombre(item.productoCanonico)];
  if (entry) { return entry.envaseVenta; }
  return { cantidad: 1, unidad: item.unidadVenta };
}

function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Precio de UN paquete (`envaseVenta`) de un artículo ya mapeado. Real de
 * catálogo Mercadona cuando existe — convertido desde `precioMercadona`, que
 * es precio-por-unidad-de-`formatoReferencia`, NO precio de paquete (ver
 * `types.ts`) — precio medio genérico en el resto. Nunca lanza ni produce
 * `NaN`/`Infinity`: cualquier dato inesperado (formato no reconocido, unidad
 * sin familia de conversión) cae al fallback genérico.
 */
export function packPrice(item: MappedGroceryItem): number {
  const envaseVenta = resolveEnvaseVenta(item);

  if (item.origenEnvase === 'mercadona' && item.precioMercadona) {
    const referencia = parseFormatoReferencia(item.precioMercadona.formatoReferencia);
    const cantidadEnvaseEnUnidadReferencia = convertirUnidad(envaseVenta.cantidad, envaseVenta.unidad, referencia.unidad);

    if (cantidadEnvaseEnUnidadReferencia !== null && referencia.cantidad > 0) {
      return item.precioMercadona.precioReferencia * (cantidadEnvaseEnUnidadReferencia / referencia.cantidad);
    }
  }

  const precioUnitario = PRECIO_MEDIO_POR_UNIDAD[envaseVenta.unidad] ?? PRECIO_MEDIO_POR_UNIDAD.unidades;
  return precioUnitario * envaseVenta.cantidad;
}

/**
 * Recorre las 21 celdas del menú y agrega, por ingrediente normalizado, la
 * cantidad TOTAL necesaria para toda la semana (dedupe real: un ingrediente
 * en 3 recetas compra lo que haga falta para el total, no 3 paquetes
 * sueltos). Slot vacío (`recipe: null`) se salta, no cuenta.
 * `recipe.meta.raciones` ausente o 0 cae a 4 — nunca divide por 0 ni
 * produce `Infinity`.
 */
export function consolidateRecipeIngredients(menu: MenuGrid, numPersonas: number): GroceryInput[] {
  const totales = new Map<string, { nombre: string, cantidad: number, unidad: string, usos: { receta: string }[] }>();

  for (const dia of DIAS) {
    for (const tipo of TIPOS) {
      const recipe = menu[dia][tipo];
      if (!recipe) { continue; }

      const raciones = recipe.meta?.raciones;
      const racionesReceta = raciones && raciones > 0 ? raciones : RACIONES_POR_DEFECTO;
      const factor = numPersonas / racionesReceta;

      for (const nombreIngrediente of recipe.ingredientes_principales ?? []) {
        const clave = normalizeNombre(nombreIngrediente);
        const base = INGREDIENT_DICTIONARY[clave]?.porcionReceta ?? { cantidad: 1, unidad: 'unidades' };
        const cantidadEscalada = base.cantidad * factor;

        const existente = totales.get(clave);
        if (existente) {
          existente.cantidad += cantidadEscalada;
          if (!existente.usos.some(u => u.receta === recipe.nombre)) {
            existente.usos.push({ receta: recipe.nombre });
          }
        }
        else {
          totales.set(clave, {
            nombre: nombreIngrediente,
            cantidad: cantidadEscalada,
            unidad: base.unidad,
            usos: [{ receta: recipe.nombre }],
          });
        }
      }
    }
  }

  return Array.from(totales.values()).map(({ nombre, cantidad, unidad, usos }) => ({
    nombre,
    cantidad,
    unidad,
    usos,
  }));
}

/**
 * Coste total estimado del menú semanal — el único número que ve Laura.
 * Nunca lanza (función pura, sin I/O): un ingrediente sin match en el
 * diccionario o un menú completamente vacío siguen produciendo un número
 * válido (`0` para un menú vacío), nunca `NaN`/excepción.
 */
export function estimateMenuCost(menu: MenuGrid, numPersonas: number): number {
  const inputs = consolidateRecipeIngredients(menu, numPersonas);
  const items = mapShoppingList(inputs);
  const total = items.reduce((suma, item) => suma + packPrice(item) * item.envasesEstimados, 0);
  return redondear2(total);
}
