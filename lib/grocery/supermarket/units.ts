import type { Envase, PrecioReferencia } from './types';

/** A reference measure as a chain prints it: `{ cantidad: 100, unidad: 'g' }` for "100 g", `{ 1, 'l' }` for "L". */
export interface MedidaReferencia {
  cantidad: number
  unidad: string
}

/**
 * Parses a `formatoReferencia` ("100 g" / "kg" / "L") into quantity + unit.
 * No leading number means 1. Never throws: an unrecognised format falls back
 * to `{cantidad: 1, unidad: <string as is>}` and the caller's own fallback
 * absorbs it.
 */
export function parseFormatoReferencia(formato: string): MedidaReferencia {
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

const A_BASE: Record<string, { factor: number, unidad: Envase['unidad'] }> = {
  g: { factor: 1, unidad: 'g' },
  gr: { factor: 1, unidad: 'g' },
  kg: { factor: 1000, unidad: 'g' },
  ml: { factor: 1, unidad: 'ml' },
  cl: { factor: 10, unidad: 'ml' },
  l: { factor: 1000, unidad: 'ml' },
  ud: { factor: 1, unidad: 'unidad' },
  unidad: { factor: 1, unidad: 'unidad' },
  unidades: { factor: 1, unidad: 'unidad' },
};

/** Converts a quantity in any known unit to its base unit, or `null` when the unit is unknown. */
export function aUnidadBase(cantidad: number, unidad: string): Envase | null {
  const entrada = A_BASE[unidad.trim().toLowerCase()];
  if (!entrada || !Number.isFinite(cantidad)) {
    return null;
  }
  return { cantidad: cantidad * entrada.factor, unidad: entrada.unidad };
}

interface PrecioDesdeReferenciaInput {
  /** Price in EUR for ONE `referencia`, e.g. 3.9 for "3,90 EUR / L". */
  precioReferencia: number
  referencia: MedidaReferencia
  envase: Envase
}

/**
 * Price of the whole pack, from a price per reference unit. Returns `null`
 * when the reference unit is unknown, is not the same family as the pack
 * (grams against millilitres), or has a non-positive quantity: a connector
 * must then drop the product rather than invent a price.
 */
export function precioEnvaseDesdeReferencia(input: PrecioDesdeReferenciaInput): number | null {
  const { precioReferencia, referencia, envase } = input;
  const base = aUnidadBase(referencia.cantidad, referencia.unidad);
  if (!base || base.unidad !== envase.unidad || base.cantidad <= 0) {
    return null;
  }
  return Math.round(precioReferencia * (envase.cantidad / base.cantidad) * 100) / 100;
}

/** Price per 1 kg / 1 l / 1 unit, so two packs of different size can be compared. */
export function precioPorUnidadReferencia(input: { precioEnvase: number, envase: Envase }): PrecioReferencia {
  const { precioEnvase, envase } = input;
  if (envase.unidad === 'g') {
    return { precio: precioEnvase / (envase.cantidad / 1000), por: 'kg' };
  }
  if (envase.unidad === 'ml') {
    return { precio: precioEnvase / (envase.cantidad / 1000), por: 'l' };
  }
  return { precio: precioEnvase / envase.cantidad, por: 'unidad' };
}
