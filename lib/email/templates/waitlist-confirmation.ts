import { CONTACT_EMAIL } from '@/lib/legal/entity';

/*
  impeccable-disable design-system-font design-system-font-size design-system-color design-system-radius
  Reason: standalone HTML email, not an app design surface; email clients do not load
  Tailwind/DESIGN.md tokens, so colours, fonts and sizes are literal inline values (same
  constraint as `subscription-confirmation.ts`).
*/

export interface WaitlistConfirmationEmailParams {
  /** Absolute URL of the page that confirms the address (carries the secret token). */
  confirmUrl: string
  /** Absolute URL of the page that removes the address (carries the same token). */
  removeUrl: string
}

const DISPLAY_STACK = '\'Young Serif\', Georgia, \'Times New Roman\', serif';
const SANS_STACK = 'Figtree, system-ui, -apple-system, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * FRESCO-1008 — the double opt-in email of the pre-launch waitlist. Says who is asking and why,
 * how to confirm, what happens if nothing is done, and how to leave. Plain on purpose: no logo,
 * no tracking, nothing but the two links.
 *
 * FRESCO-1198 — brand typography: the title in Young Serif, everything else in Figtree, with Georgia and
 * the system sans as the fallback for clients that ignore web fonts. The two font files come from our own
 * `public/fonts` (SIL OFL), never from Google: the person has not confirmed yet, and the only thing the email
 * calls besides its two links is a static file of ours, the same for every recipient.
 */
export function renderWaitlistConfirmationEmailHtml({ confirmUrl, removeUrl }: WaitlistConfirmationEmailParams): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Confirma tu correo</title>
<style>
  @font-face { font-family: 'Young Serif'; font-style: normal; font-weight: 400; font-display: swap; src: url(https://fresco-pro.vercel.app/fonts/young-serif-v2-latin-400.woff2) format('woff2'); }
  @font-face { font-family: 'Figtree'; font-style: normal; font-weight: 400 700; font-display: swap; src: url(https://fresco-pro.vercel.app/fonts/figtree-v9-latin-wght.woff2) format('woff2'); }
</style>
</head>
<body style="margin:0;padding:24px;background:#faf8f5;font-family:${SANS_STACK};color:#1f2933;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <h1 style="font-family:${DISPLAY_STACK};font-weight:400;font-size:26px;line-height:1.15;letter-spacing:-0.015em;margin:0 0 16px;">Confirma tu correo</h1>
    <p style="font-size:16px;line-height:1.5;margin:0 0 16px;">Alguien, esperamos que tú, ha pedido en Fresco que le avisemos del lanzamiento con este correo. Para empezar a avisarte necesitamos que lo confirmes.</p>
    <p style="margin:24px 0;"><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#2f7d4f;color:#ffffff;text-decoration:none;font-family:${SANS_STACK};font-weight:600;font-size:16px;padding:12px 20px;border-radius:8px;">Confirmar mi correo</a></p>
    <p style="font-size:14px;line-height:1.5;margin:0 0 12px;">Si no lo confirmas, borraremos tu correo en unos días y no te escribiremos más. Si no fuiste tú, no hace falta que hagas nada.</p>
    <p style="font-size:14px;line-height:1.5;margin:0 0 12px;">Si ya lo confirmaste y quieres que te borremos, <a href="${escapeHtml(removeUrl)}" style="color:#2f7d4f;">pulsa aquí</a>.</p>
    <p style="font-size:12px;line-height:1.5;color:#6b7280;margin:24px 0 0;">Fresco. Dudas o derechos sobre tus datos: ${escapeHtml(CONTACT_EMAIL)}. Más información en nuestra política de privacidad.</p>
  </div>
</body>
</html>`;
}
