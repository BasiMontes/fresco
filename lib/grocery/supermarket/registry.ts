import { conectorMercadona } from './catalog-connectors';
import { crearRegistro } from './connector';

/**
 * FRESCO-767 — the connectors the app may run. Consum is deliberately absent
 * (`pendiente`, FRESCO-764) until its consent answer arrives or an ADR accepts
 * the risk; `conectorConsum` stays exported from `catalog-connectors.ts` so it
 * can be added here in one line.
 */
export const registroSupermercados = crearRegistro([conectorMercadona]);
