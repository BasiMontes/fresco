/** FRESCO-51: real inbox — `hola.frescoapp@gmail.com` is the working Gmail address Supabase Auth itself sends from (no `@fresco.app` domain exists). Exported for FRESCO-429's subscription-confirmation email, which needs the same real contact address. */
export const CONTACT_EMAIL = 'hola.frescoapp@gmail.com';

/** FRESCO-430: real titular, provided by the founder — Basilio Montes Castaño, autónomo (persona física), NIF XXXXXXXXR. Domicile is published as locality-only (Utrera, Sevilla, España) by the founder's explicit choice — a known LSSI gap (full street address) accepted over publishing a private home address, not an oversight. Founder has not registered as autónomo (RETA/Hacienda) yet — a separate business-registration concern the ticket explicitly scopes out of this fix. Exported for FRESCO-429's subscription-confirmation email (art. 98.7 requires the provider's identity in the same durable-support notice). */
/**
 * FRESCO-1019: the NIF is shown masked (`XXXXXXXXR`) by the founder's decision, to cut the exposure of an
 * autónomo's NIF (the DNI number plus a letter). LSSI art. 10.1.e requires the provider's NIF to be
 * available, so this is a compliance gap the founder accepted, like the locality-only domicile above.
 * Invoices must carry the full NIF. The full value stays in git history before this change.
 */
export const LEGAL_ENTITY = 'Basilio Montes Castaño, autónomo, NIF XXXXXXXXR, con domicilio en Utrera (Sevilla), España, a efectos de notificaciones';
