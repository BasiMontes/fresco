import type { GroceryInput, MappedGroceryItem } from './types';
import type { DiaSemana, TipoPlato } from '@/lib/api/types';
import type { MenuGrid } from '@/lib/calendar/apply-slot-swap';
import { normalizeNombre } from '@/lib/text/normalize-nombre';
import { INGREDIENT_DICTIONARY } from './ingredient-dictionary';
import { mapShoppingList, recoverFromRecipeContext } from './map-item';

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

/** FRESCO-768: el parseo vive en `supermarket/units.ts` (lo comparten los conectores); se reexporta aquí por compatibilidad. */
export { parseFormatoReferencia } from './supermarket/units';

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
 * Precio de UN paquete (`envaseVenta`) de un artículo ya mapeado. FRESCO-768:
 * lee `item.precios` (precio del envase completo, ya convertido por el
 * conector de cada cadena) en vez de convertir aquí un formato de referencia
 * que solo entendía Mercadona. Sin precio real (envase estimado, ingrediente
 * desconocido, cadena sin conector ejecutable) cae al precio medio genérico.
 * Nunca lanza ni produce `NaN`/`Infinity`.
 */
export function packPrice(item: MappedGroceryItem): number {
  const envaseVenta = resolveEnvaseVenta(item);

  const real = item.precios[0];
  if (real && Number.isFinite(real.precioEnvase) && real.precioEnvase > 0) {
    return real.precioEnvase;
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
 *
 * FRESCO-340 fix-round (adversarial review finding #1): `porcionReceta` se
 * lee de la MISMA entrada canónica (directa o recuperada por contexto de
 * receta) que `mapShoppingListItem` resolverá después para el precio —
 * nunca de un lookup directo independiente. Sin esto, un ingrediente
 * genérico ("salmón") cuyo nombre de receta apunta a una variante más
 * específica ("salmón ahumado", FRESCO-488 `recoverFromRecipeContext`)
 * calculaba la cantidad con la porción del genérico pero el precio con el
 * paquete/precio de la variante recuperada — dos productos distintos
 * mezclados en un solo número.
 *
 * La recuperación se aplica POR CONTRIBUCIÓN DE RECETA (el `usos` de una
 * sola entrada, no el acumulado del bucket) y el bucket de consolidación se
 * indexa por la clave YA RESUELTA — así un "salmón" genérico en una receta
 * de la semana y un "salmón" con contexto "ahumado" en otra receta de la
 * MISMA semana no se mezclan en una sola entrada: cada uno cae en el bucket
 * del producto canónico que de verdad es, con su propia porción y precio.
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
        const directo = INGREDIENT_DICTIONARY[clave] ?? null;
        const recuperado = directo ? recoverFromRecipeContext(clave, [{ receta: recipe.nombre }]) : null;
        const entry = recuperado ?? directo;

        const base = entry?.porcionReceta ?? { cantidad: 1, unidad: 'unidades' };
        const cantidadEscalada = base.cantidad * factor;

        // Bucket por la clave YA RESUELTA (recuperada o directa) — nunca la
        // clave cruda del ingrediente — para que dos contribuciones que
        // resuelven a productos canónicos distintos no se mezclen.
        const claveResuelta = entry?.clave ?? clave;
        const nombreResuelto = entry?.canonico ?? nombreIngrediente;

        const existente = totales.get(claveResuelta);
        if (existente) {
          existente.cantidad += cantidadEscalada;
          if (!existente.usos.some(u => u.receta === recipe.nombre)) {
            existente.usos.push({ receta: recipe.nombre });
          }
        }
        else {
          totales.set(claveResuelta, {
            nombre: nombreResuelto,
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
