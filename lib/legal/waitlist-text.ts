/**
 * The waitlist's consent copy, alone in a file with no imports. The form is a Client Component and needs the
 * text; `lib/legal/waitlist.ts` needs `node:crypto` for the confirmation token and so must stay on the server.
 * Importing the text from there pulled `node:crypto` into the browser bundle, and the webpack dev build
 * refused it ("UnhandledSchemeError: Reading from node:crypto"), so the landing returned a 500 in `next dev`.
 *
 * PROVISIONAL, like every text in `consent.ts`.
 */
export const WAITLIST_CONSENT_TEXT = 'Acepto que Fresco use mi correo solo para avisarme del lanzamiento. Te pediremos que lo confirmes desde tu correo.';
