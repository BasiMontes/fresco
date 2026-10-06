import { conectorConsum, conectorMercadona } from './catalog-connectors';
import { crearRegistro } from './connector';

/**
 * FRESCO-767 — the connectors the app may run. Mercadona runs under ADR-0028
 * and Consum under ADR-0037 (`riesgo-aceptado`, consent requests unanswered).
 * If a chain answers no or blocks us, drop its connector from this list.
 *
 * FRESCO-790 — the kill-switch, as a procedure:
 *   1. delete the chain's connector from the array below (one line);
 *   2. from then on `preciosNormalizados` resolves no price and no link for
 *      that chain: the shopping list, the weekly cost estimate and the savings
 *      cards all read through it. The disclaimer under the summary drops the
 *      chain's name by itself (it is built from the data).
 *   3. mark the ADR superseded and delete the chain's generated catalog file.
 * `map-item.test.ts` ("Consum kill-switch (ADR-0037)") proves step 2, including
 * the case where the connector stays registered with `permiso: 'rechazado'`.
 */
export const registroSupermercados = crearRegistro([conectorMercadona, conectorConsum]);
