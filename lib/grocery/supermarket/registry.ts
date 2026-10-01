import { conectorConsum, conectorMercadona } from './catalog-connectors';
import { crearRegistro } from './connector';

/**
 * FRESCO-767 — the connectors the app may run. Mercadona runs under ADR-0028
 * and Consum under ADR-0037 (`riesgo-aceptado`, consent requests unanswered).
 * If a chain answers no or blocks us, drop its connector from this list.
 */
export const registroSupermercados = crearRegistro([conectorMercadona, conectorConsum]);
