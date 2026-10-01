import type { CanonicalIngredient, Confianza } from '../types';
import type { Envase, ProductoSupermercado } from './types';
import { normalizeNombre } from '@/lib/text/normalize-nombre';
import { precioPorUnidadReferencia } from './units';

/**
 * FRESCO-752 — ingredient to product matching, independent of the chain.
 *
 * Pure and deterministic: the same ingredient and candidates always give the
 * same match. The heuristic is the one `scripts/gen-mercadona-catalog.ts`
 * (FRESCO-503) already proved, lifted onto the normalized contract so every
 * chain shares it: same unit family, a plausible pack against the recipe
 * portion, the term as a whole word, canonical term before synonyms.
 */

/** Max multiple of the recipe portion a matched pack may hold; rejects bulk SKUs (FRESCO-503 review fix). */
export const MAX_RATIO_ENVASE_PORCION = 20;

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
  const limite = ingrediente.porcion.cantidad * maxRatio;

  const viables = candidatos.filter(p =>
    p.disponible
    && p.envase.unidad === ingrediente.porcion.unidad
    && p.envase.cantidad > 0
    && p.envase.cantidad <= limite
    && p.precioEnvase > 0,
  );

  for (const [indice, termino] of ingrediente.terminos.entries()) {
    const palabra = new RegExp(`\\b${escapeRegExp(termino)}`);
    const conTermino = viables.filter(p => palabra.test(normalizeNombre(p.nombre)));
    if (conTermino.length === 0) {
      continue;
    }

    const empieza = (p: ProductoSupermercado) => (normalizeNombre(p.nombre).startsWith(termino) ? 0 : 1);
    const porPrecio = (p: ProductoSupermercado) => precioPorUnidadReferencia(p).precio;
    const ordenados = [...conTermino].sort((a, b) =>
      empieza(a) - empieza(b)
      || porPrecio(a) - porPrecio(b)
      || a.envase.cantidad - b.envase.cantidad
      || a.idExterno.localeCompare(b.idExterno),
    );

    const mejor = ordenados[0];
    const penalizacion = empieza(mejor) + (indice > 0 ? 1 : 0);
    const confianza: Confianza = penalizacion === 0 ? 'alta' : penalizacion === 1 ? 'media' : 'baja';
    return { producto: mejor, termino, confianza };
  }

  return null;
}
