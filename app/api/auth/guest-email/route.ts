import type { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { captchaMissingInProduction, isCaptchaConfigured } from '@/lib/auth/captcha';
import { verifyTurnstileToken } from '@/lib/auth/turnstile-verify';
import { withinIpLimit } from '@/lib/legal/waitlist';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const RATE_LIMIT_ENDPOINT = 'guest-email-change';
const RATE_LIMIT_PER_HOUR = 3;
const RATE_LIMIT_PER_IP_PER_HOUR = 10;
const RATE_LIMIT_WINDOW_SECONDS = 3600;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;

/**
 * FRESCO-1085: per-IP ceiling (a disposable guest rotates user.id, an IP is harder to rotate), then
 * the one-shot grant the database trigger on auth.users demands before Auth may write a pending
 * email. Both need the service-role client; if it is unavailable the route refuses, never passes.
 * Returns the refusal to send, or `null` when the update may go ahead.
 */
async function grantEmailChange(headers: Headers, userId: string): Promise<NextResponse | null> {
  const failure = () => NextResponse.json({ error: { code: 'unexpected_failure', message: 'No se pudo enviar el código.' } }, { status: 500 });
  try {
    const service = createServiceClient();

    const ip = await withinIpLimit(service, { headers, endpoint: RATE_LIMIT_ENDPOINT, limit: RATE_LIMIT_PER_IP_PER_HOUR });
    if (ip.error) {
      console.error('[/api/auth/guest-email] IP rate-limit check failed', ip.error);
      return failure();
    }
    if (!ip.allowed) {
      return NextResponse.json({ error: { code: 'over_email_send_rate_limit', message: 'Demasiados intentos.' } }, { status: 429 });
    }

    const { error: grantError } = await service.rpc('grant_guest_email_change', { p_user_id: userId });
    if (grantError) {
      console.error('[/api/auth/guest-email] could not grant the email change', grantError);
      return failure();
    }
    return null;
  }
  catch (caught) {
    console.error('[/api/auth/guest-email] the service client is unavailable', caught);
    Sentry.captureException(caught);
    return failure();
  }
}

/**
 * POST /api/auth/guest-email — step 1 of the guest-to-account conversion (FRESCO-19, FRESCO-89):
 * links the typed email to the signed-in guest, which makes Supabase Auth mail a code to it.
 *
 * FRESCO-1006 (audit 7b A7-ABUSE-02): that call used to run in the browser as
 * `updateUser({ email })` with no captcha and no limit of ours, so one guest session could aim as
 * many mails as Auth's global quota allowed at addresses it did not own, and a flood would starve
 * every real code (ADR-0021: the sender is a Gmail account with a daily cap). Now:
 *
 *   1. a guest session is required (a registered user changes email somewhere else);
 *   2. with a Turnstile site key in the build, a valid token is required: missing or rejected is
 *      a 400, and a secret that is not configured or a Cloudflare that does not answer is a 503,
 *      never a pass (`captcha-field.tsx` renders the widget whenever the site key is set);
 *   3. `check_and_increment_rate_limit`: 3 an hour per guest, fail closed.
 *
 * The captcha comes before the limit, so a request that never solved one does not spend the
 * guest's quota. The Auth error of the update itself is passed through (status, code, message) so
 * the client keeps translating it and keeps seeing `email_exists`.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: { code: 'not_authenticated', message: 'No hay una sesión autenticada.' } }, { status: 401 });
  }
  if (!user.is_anonymous) {
    return NextResponse.json({ error: { code: 'not_a_guest', message: 'Esta acción es solo para sesiones de invitado.' } }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const { email, captchaToken } = (body ?? {}) as { email?: unknown, captchaToken?: unknown };
  const address = typeof email === 'string' ? email.trim() : '';
  if (address.length === 0 || address.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(address)) {
    return NextResponse.json({ error: { code: 'validation_failed', message: 'El email no es válido.' } }, { status: 400 });
  }

  // FRESCO-1170: in production a missing site key is a broken deploy, not "no captcha": refuse before any email.
  if (captchaMissingInProduction()) {
    console.error('[/api/auth/guest-email] this production build has no Turnstile site key; refusing');
    Sentry.captureMessage('guest-email: production build has no NEXT_PUBLIC_TURNSTILE_SITE_KEY', { level: 'error' });
    return NextResponse.json({ error: { code: 'captcha_unavailable', message: 'No se pudo verificar que eres una persona. Inténtalo más tarde.' } }, { status: 503 });
  }

  if (isCaptchaConfigured(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '')) {
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!secret) {
      console.error('[/api/auth/guest-email] the build shows the captcha but TURNSTILE_SECRET_KEY is not set; refusing');
      Sentry.captureMessage('guest-email: TURNSTILE_SECRET_KEY is not set', { level: 'error' });
      return NextResponse.json({ error: { code: 'captcha_unavailable', message: 'No se pudo verificar que eres una persona. Inténtalo más tarde.' } }, { status: 503 });
    }
    if (typeof captchaToken !== 'string' || captchaToken.length === 0) {
      return NextResponse.json({ error: { code: 'captcha_failed', message: 'Falta la verificación de que eres una persona.' } }, { status: 400 });
    }

    const verdict = await verifyTurnstileToken({ token: captchaToken, secret, remoteIp: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() });
    if (verdict === 'invalid') {
      return NextResponse.json({ error: { code: 'captcha_failed', message: 'No pudimos verificar que eres una persona.' } }, { status: 400 });
    }
    if (verdict === 'unavailable') {
      console.error('[/api/auth/guest-email] the Turnstile check could not be completed; refusing');
      return NextResponse.json({ error: { code: 'captcha_unavailable', message: 'No se pudo verificar que eres una persona. Inténtalo más tarde.' } }, { status: 503 });
    }
  }

  // ADR-0010: atomic check-and-increment, fail closed — only an explicit `true` passes.
  const { data: allowed, error: rateLimitError } = await supabase.rpc('check_and_increment_rate_limit', {
    p_user_id: user.id,
    p_endpoint: RATE_LIMIT_ENDPOINT,
    p_limit: RATE_LIMIT_PER_HOUR,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (rateLimitError) {
    console.error('[/api/auth/guest-email] rate-limit check failed', rateLimitError);
    return NextResponse.json({ error: { code: 'unexpected_failure', message: 'No se pudo enviar el código.' } }, { status: 500 });
  }
  if (allowed !== true) {
    return NextResponse.json({ error: { code: 'over_email_send_rate_limit', message: 'Demasiados intentos.' } }, { status: 429 });
  }

  const refusal = await grantEmailChange(request.headers, user.id);
  if (refusal) { return refusal; }

  const { error } = await supabase.auth.updateUser({ email: address });
  if (error) {
    return NextResponse.json({ error: { code: error.code ?? 'unexpected_failure', message: error.message } }, { status: error.status ?? 400 });
  }

  return NextResponse.json({ ok: true });
}
