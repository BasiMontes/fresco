import type { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { captchaMissingInProduction, isCaptchaConfigured } from '@/lib/auth/captcha';
import { verifyTurnstileToken } from '@/lib/auth/turnstile-verify';
import { sendWaitlistConfirmationEmail } from '@/lib/email/resend';
import { parseWaitlistBody, removeWaitlistSignup, requestWaitlistSignup, withinIpLimit } from '@/lib/legal/waitlist';
import { createServiceClient } from '@/lib/supabase/service';

/** Signups per client address per hour. A person needs one; a few more cover typos and a retry. */
const SIGNUPS_PER_IP_PER_HOUR = 5;

/**
 * FRESCO-1103: the Turnstile gate, the same contract as `/api/auth/guest-email`. With no site key in
 * the build there is no widget and nothing to check, except in production (FRESCO-1170), where it is
 * refused. Returns the refusal to send, or `null`.
 */
async function refuseWithoutCaptcha(request: NextRequest, captchaToken: unknown): Promise<NextResponse | null> {
  // FRESCO-1170: in production a missing site key is a broken deploy, not "no captcha": refuse before any email.
  if (captchaMissingInProduction()) {
    console.error('[/api/waitlist] this production build has no Turnstile site key; refusing');
    Sentry.captureMessage('waitlist: production build has no NEXT_PUBLIC_TURNSTILE_SITE_KEY', { level: 'error' });
    return NextResponse.json({ error: 'No se pudo verificar que eres una persona. Inténtalo más tarde.' }, { status: 503 });
  }
  if (!isCaptchaConfigured(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '')) { return null; }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    console.error('[/api/waitlist] the build shows the captcha but TURNSTILE_SECRET_KEY is not set; refusing');
    Sentry.captureMessage('waitlist: TURNSTILE_SECRET_KEY is not set', { level: 'error' });
    return NextResponse.json({ error: 'No se pudo verificar que eres una persona. Inténtalo más tarde.' }, { status: 503 });
  }
  if (typeof captchaToken !== 'string' || captchaToken.length === 0) {
    return NextResponse.json({ error: 'Falta la verificación de que eres una persona.' }, { status: 400 });
  }

  const verdict = await verifyTurnstileToken({ token: captchaToken, secret, remoteIp: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() });
  if (verdict === 'invalid') {
    return NextResponse.json({ error: 'No pudimos verificar que eres una persona.' }, { status: 400 });
  }
  if (verdict === 'unavailable') {
    console.error('[/api/waitlist] the Turnstile check could not be completed; refusing');
    return NextResponse.json({ error: 'No se pudo verificar que eres una persona. Inténtalo más tarde.' }, { status: 503 });
  }
  return null;
}

/**
 * POST /api/waitlist — asks to join the pre-launch waitlist (FRESCO-888, double opt-in FRESCO-1008).
 * Body: `{ email: string, consent: true, captchaToken?: string }`. No session is required.
 *
 * Nothing here adds anybody to a mailing list: it registers an UNCONFIRMED signup and emails the
 * address a link. Only the person who holds the mailbox can confirm it (`/api/waitlist/confirm`).
 * Every valid request answers the same 200, whether the address is new, already pending or already
 * confirmed, so the form cannot be used to find out who is on the list. The writes run with the
 * service role through database functions that set the consent version themselves; the route
 * limits each client address per hour.
 *
 * FRESCO-1103 (audit 8 A8-ABUSE-02, A8-ABUSE-03, A8-OPS-02): every new address makes the app mail
 * a stranger from the account that also sends the Stripe receipts (ADR-0021), so a build that
 * shows the Turnstile widget (a site key is set) also requires a valid token here, before the
 * limit is spent: missing or rejected is 400, an unset secret or a Cloudflare that does not answer
 * is 503, never a pass. A confirmation email that fails to send is reported to Sentry and the
 * signup it registered is removed, so the visitor's retry sends again instead of landing on the
 * 10-minute `throttled` window with nothing in the inbox.
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

  const refusal = await refuseWithoutCaptcha(request, (body as { captchaToken?: unknown }).captchaToken);
  if (refusal) { return refusal; }

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
      Sentry.captureException(error, { tags: { route: 'waitlist' } });
      // Give the signup back: left in place it would answer the retry 'throttled' for 10 minutes.
      const removed = await removeWaitlistSignup(service, result.token).catch((caught: unknown) => ({ error: caught, found: false }));
      if (removed.error) {
        console.error('[/api/waitlist] could not remove the signup whose email failed', removed.error);
        Sentry.captureException(removed.error, { tags: { route: 'waitlist', step: 'release-throttle' } });
      }
      return NextResponse.json({ error: 'No hemos podido enviarte el correo de confirmación. Inténtalo de nuevo en unos minutos.' }, { status: 502 });
    }
  }

  return NextResponse.json({ pending: true });
}
