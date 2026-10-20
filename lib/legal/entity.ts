/** FRESCO-51: real inbox — `hola.frescoapp@gmail.com` is the working Gmail address Supabase Auth itself sends from (no `@fresco.app` domain exists). Exported for FRESCO-429's subscription-confirmation email, which needs the same real contact address. */
export const CONTACT_EMAIL = 'hola.frescoapp@gmail.com';

/**
 * FRESCO-430: the titular, provided by the founder. Exported for FRESCO-429's subscription-confirmation email
 * (art. 98.7 requires the provider's identity in the same durable-support notice).
 *
 * FRESCO-1037: the text carries no «autónomo» and no NIF, by the founder's decision of 2026-10-20. «Autónomo» was
 * not true yet (no alta, FRESCO-911) and the masked NIF `XXXXXXXXR` of FRESCO-1019 was a placeholder that looks like
 * real data. The domicile is published as locality-only (Utrera, Sevilla, España) by the founder's explicit choice.
 * Both the missing NIF and the partial address are compliance gaps the founder accepted until the alta; art. 97 of
 * the TRLGDCU asks for the empresario's identity, full address, phone and email before contracting, and the NIF is
 * also asked for by LSSI art. 10.1.e (not checked against the current wording). When the alta exists, put the real
 * data here: the summary, the subscription email and the Terms all read this one constant.
 */
export const LEGAL_ENTITY = 'Basilio Montes Castaño, con domicilio en Utrera (Sevilla), España, a efectos de notificaciones';
