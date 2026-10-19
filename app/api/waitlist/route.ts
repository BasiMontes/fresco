import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { sendWaitlistConfirmationEmail } from '@/lib/email/resend';
import { parseWaitlistBody, requestWaitlistSignup, withinIpLimit } from '@/lib/legal/waitlist';
import { createServiceClient } from '@/lib/supabase/service';

/** Signups per client address per hour. A person needs one; a few more cover typos and a retry. */
const SIGNUPS_PER_IP_PER_HOUR = 5;

/**
 * POST /api/waitlist — asks to join the pre-launch waitlist (FRESCO-888, double opt-in FRESCO-1008).
 * Body: `{ email: string, consent: true }`. No session is required.
 *
 * Nothing here adds anybody to a mailing list: it registers an UNCONFIRMED signup and emails the
 * address a link. Only the person who holds the mailbox can confirm it (`/api/waitlist/confirm`).
 * Every valid request answers the same 200, whether the address is new, already pending or already
 * confirmed, so the form cannot be used to find out who is on the list. The writes run with the
 * service role through database functions that set the consent version themselves; the route
 * limits each client address per hour.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  }
  catch {
    return NextResponse.json({ error: 'El cuerpo de la petición no es JSON válido.' }, { status: 400 });
  }

  const parsed = parseWaitlistBody(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Escribe un correo válido y acepta el consentimiento.' }, { status: 400 });
  }

  const service = createServiceClient();

  const limit = await withinIpLimit(service, { headers: request.headers, endpoint: 'waitlist-signup', limit: SIGNUPS_PER_IP_PER_HOUR });
  if (limit.error) {
    console.error('[/api/waitlist] rate limit check failed', limit.error);
    return NextResponse.json({ error: 'No se pudo apuntar tu correo. Inténtalo de nuevo.' }, { status: 500 });
  }
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' }, { status: 429 });
  }

  const result = await requestWaitlistSignup(service, parsed.email);
  if (result.error) {
    console.error('[/api/waitlist] failed to register the signup', result.error);
    return NextResponse.json({ error: 'No se pudo apuntar tu correo. Inténtalo de nuevo.' }, { status: 500 });
  }

  if (result.token) {
    const origin = request.nextUrl.origin;
    try {
      await sendWaitlistConfirmationEmail({
        to: parsed.email,
        confirmUrl: `${origin}/lista-de-espera?token=${result.token}&accion=confirmar`,
        removeUrl: `${origin}/lista-de-espera?token=${result.token}&accion=baja`,
      });
    }
    catch (error) {
      console.error('[/api/waitlist] failed to send the confirmation email', error);
      return NextResponse.json({ error: 'No hemos podido enviarte el correo de confirmación. Inténtalo de nuevo en unos minutos.' }, { status: 502 });
    }
  }

  return NextResponse.json({ pending: true });
}
