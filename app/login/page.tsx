'use client';

import type { FormEvent } from 'react';
import { isAuthError } from '@supabase/supabase-js';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Suspense, useRef, useState } from 'react';
import { LegalLinks } from '@/components/legal/legal-links';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { translateAuthError } from '@/lib/auth-errors';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { createClient } from '@/lib/supabase/client';

/**
 * `/login` — sign-in counterpart to `/signup` for an existing account.
 * Wrapped in `Suspense` (Next 16 docs: a static page calling
 * `useSearchParams` from a Client Component must have one, or the
 * production build fails).
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  // FRESCO-48: `callEdgeFunction` redirects here with this flag on a 401
  // (expired/invalid JWT) — without it, a session-expiry redirect looks
  // identical to a visitor who just chose to log in, with no explanation
  // for why they were bounced.
  const sessionExpired = useSearchParams().get('session_expired') === '1';
  // FRESCO-52: `/update-password` redirects here (after signing the user out)
  // once her new password is saved, so she lands with a real login step and
  // a confirmation her password actually changed — not silently signed in.
  const passwordReset = useSearchParams().get('password_reset') === '1';
  // FRESCO-70: `/profile`'s delete-account dialog redirects here (after
  // signing out) once the account is gone — a plain farewell confirmation,
  // same query-flag pattern as `passwordReset` above.
  const accountDeleted = useSearchParams().get('account_deleted') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  // FRESCO-190: set when login fails specifically because the account's
  // email was never confirmed — the compounding half of the signup bug,
  // where the account exists but was unreachable with no way to get a new
  // confirmation link. Holds the email so the resend button below doesn't
  // need her to retype it.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [resendConfirmationMessage, setResendConfirmationMessage] = useState<string | null>(null);
  // FRESCO-114: `disabled={isSubmitting}` alone depends on a React re-render
  // that doesn't land in time for two synchronous clicks in the same JS
  // tick — confirmed live via a programmatic double-click, 2 identical
  // POSTs to /auth/v1/token. A ref is read/written synchronously, so it
  // catches the second click even before React re-renders the button.
  const isSubmittingRef = useRef(false);
  // FRESCO-189: Supabase already rate-limits repeated failures server-side
  // (`over_request_rate_limit`, already translated below), but nothing told
  // the user that repeated failures were even being noticed — a QA sweep of
  // 5 rapid attempts against the same account got the same generic 400
  // every time, with no escalating signal. This is a client-side-only
  // counter (never sent anywhere, resets on success or page reload) purely
  // to surface a visible warning after a few failures in a row.
  const [failedAttempts, setFailedAttempts] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingRef.current) { return; }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setLoginError(null);
    setUnconfirmedEmail(null);
    setResendConfirmationMessage(null);
    try {
      const client = createClient();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError(translateAuthError(error));
        setFailedAttempts(count => count + 1);
        // FRESCO-190: surface a resend affordance instead of leaving her
        // stuck on a generic error with no path back to her account.
        if (isAuthError(error) && error.code === 'email_not_confirmed') {
          setUnconfirmedEmail(email);
        }
        return;
      }
      // FRESCO-150: sessionStorage isn't scoped per-account — clear any
      // draft left by a previous session in this same browser tab so it
      // doesn't leak into this account's onboarding.
      useOnboardingStore.getState().reset();
      // ADR-0013: input to PostHog's native retention report — the reason
      // this vendor was chosen over the alternatives.
      captureEvent(POSTHOG_EVENTS.SESSION_STARTED);
      router.push('/menu');
    }
    finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleResendConfirmation() {
    if (!unconfirmedEmail) { return; }
    setIsResendingConfirmation(true);
    setResendConfirmationMessage(null);
    try {
      const client = createClient();
      const { error } = await client.auth.resend({ type: 'signup', email: unconfirmedEmail });
      if (error) {
        setLoginError(translateAuthError(error));
        return;
      }
      setResendConfirmationMessage('Te enviamos un nuevo enlace de confirmación.');
    }
    finally {
      setIsResendingConfirmation(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      {/* FRESCO-269: logo and LegalLinks are absolutely positioned around the
          Card instead of sharing its justify-center flow — their unequal
          heights (logo ~98px vs. footer ~30px) were shifting the Card's own
          center off the viewport center by a fixed ~19px. */}
      <div className="relative">
        <Image
          src="/brand/logo-base.svg"
          alt="Fresco"
          width={112}
          height={34}
          className="absolute bottom-full left-1/2 mb-8 -translate-x-1/2"
          priority
        />

        <Card className="p-6 md:p-8">
          <h1 className="text-h3">Inicia sesión</h1>
          <p className="mt-1 text-body-sm text-tertiary">
            Accede a tu cuenta para ver tu menú.
          </p>

          {sessionExpired && (
            <p data-testid="session_expired_message" role="alert" aria-live="assertive" className="mt-4 text-body-sm text-error">
              Tu sesión expiró. Inicia sesión de nuevo.
            </p>
          )}

          {passwordReset && (
            <p data-testid="password_reset_success_message" role="status" aria-live="polite" className="mt-4 text-body-sm text-primary">
              Tu contraseña se actualizó. Inicia sesión con la nueva.
            </p>
          )}

          {accountDeleted && (
            <p data-testid="account_deleted_message" role="status" aria-live="polite" className="mt-4 text-body-sm text-primary">
              Tu cuenta se eliminó correctamente. Gracias por haber probado Fresco.
            </p>
          )}

          <form onSubmit={event => void handleSubmit(event)} className="mt-6 flex flex-col gap-3">
            {/* FRESCO-315: real <label for> — the accessible name was carried
                only by aria-label duplicating the placeholder (WCAG 3.3.2 /
                4.1.2). sr-only keeps the minimalist card design unchanged. */}
            <label htmlFor="login-email" className="sr-only">Correo electrónico</label>
            <Input
              id="login-email"
              data-testid="email_input"
              type="email"
              placeholder="Correo electrónico"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <label htmlFor="login-password" className="sr-only">Contraseña</label>
            <Input
              id="login-password"
              data-testid="password_input"
              type="password"
              placeholder="Contraseña"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <Button data-testid="login_submit_button" type="submit" className="mt-2" disabled={isSubmitting}>
              {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </Button>
          </form>

          <p className="mt-3 text-center text-body-sm">
            <Link href="/forgot-password" data-testid="forgot_password_link" className="text-primary">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>

          {loginError && (
            <p data-testid="login_error_message" role="alert" aria-live="assertive" className="mt-4 text-body-sm text-error">
              {loginError}
            </p>
          )}

          {failedAttempts >= 3 && (
            <p data-testid="login_repeated_failures_message" role="alert" aria-live="assertive" className="mt-2 text-body-sm text-tertiary">
              Varios intentos fallidos seguidos. Si no recuerdas tu contraseña, puedes
              {' '}
              <Link href="/forgot-password" className="text-primary">
                restablecerla
              </Link>
              .
            </p>
          )}

          {unconfirmedEmail && (
            <div className="mt-2 text-center">
              <button
                type="button"
                data-testid="resend_confirmation_button"
                onClick={() => void handleResendConfirmation()}
                disabled={isResendingConfirmation}
                className="text-body-sm text-primary underline"
              >
                {isResendingConfirmation ? 'Reenviando…' : 'Reenviar email de confirmación'}
              </button>
              {resendConfirmationMessage && (
                <p data-testid="resend_confirmation_message" role="status" aria-live="polite" className="mt-1 text-body-sm text-tertiary">
                  {resendConfirmationMessage}
                </p>
              )}
            </div>
          )}

          <p className="mt-4 text-center text-body-sm text-tertiary">
            ¿No tienes cuenta?
            {' '}
            <Link href="/signup" className="text-primary">
              Crea una
            </Link>
          </p>
        </Card>

        <div className="absolute inset-x-0 top-full">
          <LegalLinks />
        </div>
      </div>
    </div>
  );
}
