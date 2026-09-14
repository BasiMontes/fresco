import type { ShoppingListPasillo } from '@/lib/api/types';

/**
 * FRESCO-345 (Pieza A — export estructurado, comentario "Refinamiento v2" +
 * "Spec Implementation Plan (Dev)" del 2026-09-14).
 *
 * Módulo puro, sin I/O: transforma la lista de la compra ya agrupada por
 * pasillo (`ShoppingListPasillo[]`, el mismo shape que `ShoppingListView`
 * ya tiene en memoria) en las dos salidas de export — texto plano para
 * "Copiar" y CSV para "Descargar". No hay generación de PDF en esta pieza
 * (Decision 1 del plan: el AC v2 dice "CSV o PDF" en disyunción, y no
 * existe ninguna librería de PDF en `package.json` — añadir una para un
 * único botón viola YAGNI).
 *
 * `formatUnidad`/`capitalize` están deliberadamente duplicadas de
 * `shopping-list-view.tsx` (Decision 3 del plan) en vez de extraídas a un
 * módulo compartido: son ~3 líneas cada una y refactorizar un componente de
 * 570 líneas ya testeado por esa ganancia marginal viola "Surgical
 * Changes" (AGENTS.md §2).
 */

/** Mismo criterio que `formatUnidad` de `shopping-list-view.tsx`: singulariza solo el caso confirmado roto ("1 unidades" -> "1 unidad"). */
function formatUnidad(cantidad: number, unidad: string): string {
  return cantidad === 1 && unidad === 'unidades' ? 'unidad' : unidad;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Texto plano agrupado por pasillo: encabezado en mayúsculas, una línea por
 * artículo con cantidad + unidad + nombre. Incluye TODOS los artículos,
 * comprados y pendientes (Decision 2 del plan — la Business Rule v2 dice
 * "el export refleja la lista tal cual está", sin filtrar por preferencia
 * de usuario que nadie pidió). Lista vacía -> mensaje explícito, nunca
 * cadena vacía silenciosa.
 */
export function formatShoppingListAsText(pasillos: ShoppingListPasillo[]): string {
  if (pasillos.length === 0) {
    return 'Lista de la compra vacía.';
  }

  return pasillos
    .map((pasillo) => {
      const encabezado = pasillo.nombre.toUpperCase();
      const lineas = pasillo.items.map(
        item => `- ${item.cantidad} ${formatUnidad(item.cantidad, item.unidad)} ${capitalize(item.nombre)}`,
      );
      return [encabezado, ...lineas].join('\n');
    })
    .join('\n\n');
}

/** Campos que necesitan comillas RFC-4180: coma, comilla doble o salto de línea. */
const CSV_NEEDS_QUOTING = /[",\n]/;

/** Escapa un campo CSV per RFC-4180: si contiene coma/comilla/salto de línea, lo envuelve en comillas dobles y duplica las comillas internas. */
function escapeCsvField(value: string): string {
  if (!CSV_NEEDS_QUOTING.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

const CSV_HEADER = ['Pasillo', 'Artículo', 'Cantidad', 'Unidad', 'Comprado'];

/**
 * CSV agrupado por pasillo, una fila por artículo. Incluye TODOS los
 * artículos (mismo criterio que el texto plano, columna `Comprado`
 * distingue Sí/No). Lista vacía -> solo la cabecera, nunca un archivo
 * vacío de verdad.
 */
export function formatShoppingListAsCsv(pasillos: ShoppingListPasillo[]): string {
  const filas = pasillos.flatMap(pasillo =>
    pasillo.items.map(item => [
      pasillo.nombre,
      capitalize(item.nombre),
      String(item.cantidad),
      formatUnidad(item.cantidad, item.unidad),
      item.comprado ? 'Sí' : 'No',
    ]),
  );

  return [CSV_HEADER, ...filas]
    .map(fila => fila.map(escapeCsvField).join(','))
    .join('\n');
}

export interface SupermarketLink {
  label: string
  url: string
}

/**
 * Home de cada supermercado, sin parámetros de búsqueda ni afiliación
 * (Scope v2 de la historia: "abrir app/web... sin precargar", y el propio
 * plan de Stage 1 marca los enlaces de afiliación Awin explícitamente fuera
 * de alcance de ESTA historia — ver "Out of scope"). La resolución
 * app-si-está-instalada / web-si-no (Business Rule v2) la hace el sistema
 * operativo sobre una URL `https://` normal, cero código adicional.
 */
export const SUPERMARKET_LINKS: Record<'mercadona' | 'carrefour' | 'dia', SupermarketLink> = {
  mercadona: { label: 'Mercadona', url: 'https://www.mercadona.es' },
  carrefour: { label: 'Carrefour', url: 'https://www.carrefour.es' },
  dia: { label: 'Dia', url: 'https://www.dia.es' },
};
