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

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * FRESCO-1008 — the double opt-in email of the pre-launch waitlist. Says who is asking and why,
 * how to confirm, what happens if nothing is done, and how to leave. Plain on purpose: no logo,
 * no tracking, nothing but the two links.
 */
export function renderWaitlistConfirmationEmailHtml({ confirmUrl, removeUrl }: WaitlistConfirmationEmailParams): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Confirma tu correo</title></head>
<body style="margin:0;padding:24px;background:#faf8f5;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <h1 style="font-size:22px;margin:0 0 16px;">Confirma tu correo</h1>
    <p style="font-size:16px;line-height:1.5;margin:0 0 16px;">Alguien, esperamos que tú, ha pedido en Fresco que le avisemos del lanzamiento con este correo. Para empezar a avisarte necesitamos que lo confirmes.</p>
    <p style="margin:24px 0;"><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#2f7d4f;color:#ffffff;text-decoration:none;font-size:16px;padding:12px 20px;border-radius:8px;">Confirmar mi correo</a></p>
    <p style="font-size:14px;line-height:1.5;margin:0 0 12px;">Si no lo confirmas, borraremos tu correo en unos días y no te escribiremos más. Si no fuiste tú, no hace falta que hagas nada.</p>
    <p style="font-size:14px;line-height:1.5;margin:0 0 12px;">Si ya lo confirmaste y quieres que te borremos, <a href="${escapeHtml(removeUrl)}" style="color:#2f7d4f;">pulsa aquí</a>.</p>
    <p style="font-size:12px;line-height:1.5;color:#6b7280;margin:24px 0 0;">Fresco. Dudas o derechos sobre tus datos: ${escapeHtml(CONTACT_EMAIL)}. Más información en nuestra política de privacidad.</p>
  </div>
</body>
</html>`;
}
