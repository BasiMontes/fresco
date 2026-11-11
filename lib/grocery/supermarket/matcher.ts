import type { CanonicalIngredient, Confianza } from '../types';
import type { Envase, ProductoSupermercado } from './types';
import { normalizeNombre } from '@/lib/text/normalize-nombre';
import { esProductoPlausible } from '../product-plausibility';

/**
 * FRESCO-752 — ingredient to product matching, independent of the chain.
 *
 * Pure and deterministic: the same ingredient and candidates always give the
 * same match. The heuristic is the one `scripts/gen-mercadona-catalog.ts`
 * (FRESCO-503) already proved, lifted onto the normalized contract so every
 * chain shares it: same unit family, a plausible pack against the recipe
 * portion, the term as a whole word, canonical term before synonyms.
 *
 * FRESCO-846: both catalog generators (`gen-mercadona-catalog.ts`,
 * `gen-consum-catalog.ts`) call it, so ADR-0036 decision 5 holds in practice.
 * Ties go to the product whose name starts with the term, then the shorter
 * name (the plain product, not a derived or mixed one), then the smaller pack,
 * then the cheaper pack, then the id. Cheapest-per-unit was tried and rejected: it picked frozen,
 * bulk and derived products (FRESCO-846 catalog review).
 */

/** Max multiple of the recipe portion a matched pack may hold; rejects bulk SKUs (FRESCO-503 review fix). */
export const MAX_RATIO_ENVASE_PORCION = 20;

/**
 * FRESCO-1098: fresh fish and shellfish are bought in packs close to the recipe
 * portion. A pack far below it is a tin (a 111 g tin of mussels for a 500 g
 * portion), a pack far above it is a whole cut (a 2,5 kg cod loin for 400 g);
 * either one prices the line at a figure unrelated to the fresh ingredient.
 */
const MARISCO_Y_PESCADO_FRESCO = /^(?:mejillones|almejas|berberechos|bacalao|salmon|merluza|gambas|calamares|sepia|pulpo|lubina|dorada)\b/;
export const RATIO_ENVASE_PESCADO_FRESCO = { min: 0.5, max: 3 } as const;

/**
 * FRESCO-1194: wine is bought in a standard bottle. The recipe portion is small (200 ml of white wine), so a
 * single-serve 187 ml bottle sits just under it and passed every ratio rule, and the tie-break (smaller pack)
 * then preferred it over the 750 ml bottle people actually buy; the shopping list priced a line at a figure
 * unrelated to the ingredient. A pack under this size is not a match for a wine. It is a floor in ml, not a
 * ratio: against a 200 ml portion a ratio cannot tell a 187 ml mini from a 250 ml bottle, and no ratio rule
 * could be applied to every liquid without moving the matches of the others.
 */
const VINO = /^vino\b/;
export const ENVASE_MINIMO_VINO_ML = 330;

export interface IngredienteParaMatching {
  /** Search terms in priority order: the canonical name first, then synonyms. */
  terminos: string[]
  /** The recipe portion, in the base unit the pack must share. */
  porcion: Envase
}

export interface Coincidencia {
  producto: ProductoSupermercado
  /** The term that produced the match. */
  termino: string
  confianza: Confianza
}

/**
 * Builds the matcher input from a FRESCO-488 dictionary entry. Returns `null`
 * for count-based portions (eggs, cloves): like the catalog generators, this
 * layer only matches g and ml ingredients.
 */
export function ingredienteParaMatching(
  entrada: Pick<CanonicalIngredient, 'canonico' | 'terminoBusqueda' | 'sinonimos' | 'porcionReceta'>,
): IngredienteParaMatching | null {
  const { cantidad, unidad } = entrada.porcionReceta;
  if ((unidad !== 'g' && unidad !== 'ml') || cantidad <= 0) {
    return null;
  }
  const vistos = new Set<string>();
  const terminos: string[] = [];
  for (const candidato of [entrada.canonico, entrada.terminoBusqueda, ...entrada.sinonimos]) {
    const normalizado = normalizeNombre(candidato);
    if (normalizado && !vistos.has(normalizado)) {
      vistos.add(normalizado);
      terminos.push(normalizado);
    }
  }
  return { terminos, porcion: { cantidad, unidad } };
}

function escapeRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface EmparejarInput {
  ingrediente: IngredienteParaMatching
  candidatos: readonly ProductoSupermercado[]
  maxRatio?: number
}

export function emparejarIngrediente(input: EmparejarInput): Coincidencia | null {
  const { ingrediente, candidatos, maxRatio = MAX_RATIO_ENVASE_PORCION } = input;
  const esPescadoFresco = MARISCO_Y_PESCADO_FRESCO.test(ingrediente.terminos[0] ?? '');
  const limite = ingrediente.porcion.cantidad * (esPescadoFresco ? Math.min(maxRatio, RATIO_ENVASE_PESCADO_FRESCO.max) : maxRatio);
  const esVino = ingrediente.porcion.unidad === 'ml' && VINO.test(ingrediente.terminos[0] ?? '');
  const minimo = esPescadoFresco ? ingrediente.porcion.cantidad * RATIO_ENVASE_PESCADO_FRESCO.min : esVino ? ENVASE_MINIMO_VINO_ML : 0;

  const viables = candidatos.filter(p =>
    p.disponible
    && p.envase.unidad === ingrediente.porcion.unidad
    && p.envase.cantidad > 0
    && p.envase.cantidad >= minimo
    && p.envase.cantidad <= limite
    && p.precioEnvase > 0,
  );

  for (const [indice, termino] of ingrediente.terminos.entries()) {
    const palabra = new RegExp(`\\b${escapeRegExp(termino)}(?:e?s)?\\b`);
    const conTermino = viables.filter(p =>
      palabra.test(normalizeNombre(p.nombre)) && esProductoPlausible(ingrediente.terminos[0], p.nombre),
    );
    if (conTermino.length === 0) {
      continue;
    }

    const empieza = (p: ProductoSupermercado) => (normalizeNombre(p.nombre).startsWith(termino) ? 0 : 1);
    const ordenados = [...conTermino].sort((a, b) =>
      empieza(a) - empieza(b)
      || a.nombre.length - b.nombre.length
      || a.envase.cantidad - b.envase.cantidad
      || a.precioEnvase - b.precioEnvase
      || a.idExterno.localeCompare(b.idExterno),
    );

    const mejor = ordenados[0];
    const penalizacion = empieza(mejor) + (indice > 0 ? 1 : 0);
    const confianza: Confianza = penalizacion === 0 ? 'alta' : penalizacion === 1 ? 'media' : 'baja';
    return { producto: mejor, termino, confianza };
  }

  return null;
}
