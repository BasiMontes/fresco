/**
 * FRESCO-770 — what to write when a connector reports a price. Pure: the
 * runner reads the current row and applies the decision.
 *
 * `supermarket_price` holds the latest observation per product and zone;
 * `supermarket_price_history` gets a row only when the price or the
 * availability actually changed, so it stays small (design §5).
 */

export interface ObservacionDePrecio {
  precioEnvase: number
  disponible: boolean
  /** ISO 8601 instant. */
  observadoEn: string
}

export type DecisionEscritura
  /** Nothing to write: the observation is not newer, or its date is unusable. */
  = | 'ignorar'
    /** Same price and availability: only move the observation date forward. */
    | 'actualizar'
    /** First observation, or a changed price or availability: update and append to history. */
    | 'actualizar-con-historial';

/** `precio_envase` is numeric(10, 2): compare in cents, never as floats. */
function centimos(precio: number): number {
  return Math.round(precio * 100);
}

export function decidirEscritura(
  actual: ObservacionDePrecio | null,
  nueva: ObservacionDePrecio,
): DecisionEscritura {
  const instanteNuevo = new Date(nueva.observadoEn).getTime();
  // Fail-closed: a price we cannot date is never written.
  if (Number.isNaN(instanteNuevo) || !(nueva.precioEnvase > 0)) {
    return 'ignorar';
  }
  if (actual === null) {
    return 'actualizar-con-historial';
  }
  const instanteActual = new Date(actual.observadoEn).getTime();
  if (!Number.isNaN(instanteActual) && instanteNuevo <= instanteActual) {
    return 'ignorar';
  }
  const igual = centimos(actual.precioEnvase) === centimos(nueva.precioEnvase)
    && actual.disponible === nueva.disponible;
  return igual ? 'actualizar' : 'actualizar-con-historial';
}
