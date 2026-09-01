'use client';

import type { FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmailInput } from '@/components/ui/email-input';
import { PasswordInput } from '@/components/ui/password-input';
import { translateAuthError } from '@/lib/auth-errors';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { createClient } from '@/lib/supabase/client';
import { isPasswordTooShort, PASSWORD_TOO_SHORT_MESSAGE } from '@/lib/validation/password-policy';
import { isPasswordPwned, PWNED_PASSWORD_MESSAGE } from '@/lib/validation/pwned-password';

export interface IdentityStepProps {
  /** Called once a real Supabase session exists (guest or freshly-created account). */
  onResolved: () => void
}

type IdentityChoice = 'guest' | 'account' | null;

/**
 * FRESCO-197: the first thing a brand-new visitor to `/onboarding` sees —
 * "continuar como invitada" (no prompts at all, ADR-0003 `signInAnonymously`)
 * vs "crear cuenta" (asks email + password only on this branch, using
 * FRESCO-198's `EmailInput`/`PasswordInput`).
 *
 * A plain `signUp()`, not the anonymous-then-`updateUser()` upgrade path —
 * she has no anonymous session yet at this point (that upgrade path is
 * `/signup`'s job, for a guest who already generated a menu and decides
 * later). Mirrors `/signup`'s own edge cases (anti-enumeration `identities:
 * []`, pending-email-confirmation) rather than inventing new copy for them.
 */
export function IdentityStep({ onResolved }: IdentityStepProps) {
  const [choice, setChoice] = useState<IdentityChoice>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  // FRESCO-252: plays the entrance stagger (logo -> heading -> actions) once,
  // on mount — `useEffect` fires after the first paint, so the CSS transition
  // (see `.t-stagger` in globals.css) actually animates from its initial
  // `opacity: 0` state instead of skipping straight to `is-shown`.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    setEntered(true);
  }, []);

  async function handleGuest() {
    setIsSubmitting(true);
    setError(null);
    try {
      const client = createClient();
      const { error: guestError } = await client.auth.signInAnonymously();
      if (guestError) {
        // ADR-0003: anonymous sign-ins are rate-limited (30/hour) on this
        // project — a real, previously-observed failure mode.
        setError('No pudimos iniciar tu visita como invitada. Recarga la página e inténtalo de nuevo.');
        return;
      }
      // identify() fires independently, asynchronously, via the provider's onAuthStateChange — ordering vs. this capture is unguaranteed but safe (PostHog merges anonymous-device history on first identify regardless of order).
      captureEvent(POSTHOG_EVENTS.USER_SIGNED_UP, { method: 'guest' });
      onResolved();
    }
    finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    // Mirrors /signup's own pre-check (FRESCO-123): reject a weak password
    // before hitting the network — same threshold the server enforces
    // (FRESCO-363 / A4-H8, `lib/validation/password-policy.ts`).
    if (isPasswordTooShort(password)) {
      setError(PASSWORD_TOO_SHORT_MESSAGE);
      setIsSubmitting(false);
      return;
    }
    // FRESCO-32: reject a known-breached password before signUp. Fail-open.
    if (await isPasswordPwned(password)) {
      setError(PWNED_PASSWORD_MESSAGE);
      setIsSubmitting(false);
      return;
    }
    try {
      const client = createClient();
      const { data, error: signUpError } = await client.auth.signUp({
        email,
        password,
        // FRESCO-264 — see app/signup/page.tsx for why this must be
        // /auth/confirm, not a bare path.
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding` },
      });
      if (signUpError) {
        setError(translateAuthError(signUpError));
        return;
      }
      // Same anti-enumeration behavior /signup already documents: Supabase
      // returns 200 with empty `identities` when the email already belongs
      // to a confirmed account, instead of a normal error.
      if (data.user?.identities?.length === 0) {
        setError('Ya existe una cuenta con ese email. Inicia sesión en su lugar.');
        return;
      }
      // Resend SMTP is currently blocked for this project (no owned sending
      // domain yet — known, deliberately-deferred infra gap, ADR-0003
      // Consequences). `signUp()` returns 200 the instant the account row is
      // created, regardless of whether Supabase actually issued a session —
      // when email confirmation is required (the normal case here), it
      // won't have. Handle it as a real, expected state rather than a dead
      // end: same pattern as `/signup`'s `signupPendingConfirmation`.
      captureEvent(POSTHOG_EVENTS.USER_SIGNED_UP, { method: 'account' });
      if (!data.session) {
        setPendingConfirmation(true);
        return;
      }
      onResolved();
    }
    finally {
      setIsSubmitting(false);
    }
  }

  if (pendingConfirmation) {
    return (
      <Card className="p-6 md:p-8">
        <div className={`t-stagger ${entered ? 'is-shown' : ''}`}>
          <Image
            src="/brand/logo-base.svg"
            alt="Fresco"
            width={100}
            height={30}
            priority
            className="t-stagger-line t-stagger-line--1"
          />

          <div className="t-stagger-line t-stagger-line--2 mt-6">
            <h1 className="text-h3">Revisa tu correo</h1>
            <p data-testid="onboarding_signup_pending_confirmation_message" role="status" aria-live="polite" className="mt-2 text-body-sm text-tertiary">
              Te enviamos un enlace de confirmación a
              {' '}
              <strong>{email}</strong>
              . Ábrelo para activar tu cuenta y luego inicia sesión.
            </p>
          </div>

          <p className="t-stagger-line t-stagger-line--3 mt-8 text-center text-body-sm text-tertiary">
            <Link href="/login" className="text-primary">Ir a iniciar sesión</Link>
          </p>
        </div>
      </Card>
    );
  }

  if (choice === 'account') {
    return (
      <Card className="p-6 md:p-8">
        <div className={`t-stagger ${entered ? 'is-shown' : ''}`}>
          <Image
            src="/brand/logo-base.svg"
            alt="Fresco"
            width={100}
            height={30}
            priority
            className="t-stagger-line t-stagger-line--1"
          />

          <div className="t-stagger-line t-stagger-line--2 mt-6">
            <h1 className="text-h3">Crea tu cuenta</h1>
            <p className="mt-2 text-body-sm text-tertiary">Así no pierdes tu progreso ni tu menú.</p>
          </div>

          <div className="t-stagger-line t-stagger-line--3 mt-8">
            <form onSubmit={event => void handleCreateAccount(event)} className="flex flex-col gap-3">
              <EmailInput value={email} onChange={setEmail} />
              <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
              <Button data-testid="onboarding_create_account_submit_button" type="submit" className="mt-2" disabled={isSubmitting}>
                {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta y continuar'}
              </Button>
            </form>
          </div>
        </div>

        {error && (
          <p data-testid="onboarding_identity_error_message" role="alert" aria-live="assertive" className="mt-4 text-body-sm text-error">
            {error}
          </p>
        )}

        <button
          type="button"
          data-testid="onboarding_back_to_choice_button"
          onClick={() => {
            setChoice(null);
            setError(null);
          }}
          className="mt-4 w-full text-center text-body-sm text-tertiary underline"
        >
          Volver
        </button>
      </Card>
    );
  }

  return (
    <Card data-testid="onboarding_identity_step" className="p-6 md:p-8">
      <div className={`t-stagger ${entered ? 'is-shown' : ''}`}>
        <Image
          src="/brand/logo-base.svg"
          alt="Fresco"
          width={100}
          height={30}
          priority
          className="t-stagger-line t-stagger-line--1"
        />

        <div className="t-stagger-line t-stagger-line--2 mt-6">
          <h1 className="text-h3">¿Cómo quieres empezar?</h1>
          <p className="mt-2 text-body-sm text-tertiary">Puedes probar Fresco sin registrarte, o crear una cuenta desde ya.</p>
        </div>

        <div className="t-stagger-line t-stagger-line--3 mt-8">
          <div className="flex flex-col gap-4">
            <Button
              data-testid="onboarding_create_account_button"
              variant="action"
              onClick={() => setChoice('account')}
              disabled={isSubmitting}
            >
              Crear cuenta
            </Button>
            <Button
              data-testid="onboarding_continue_as_guest_button"
              variant="secondary"
              onClick={() => void handleGuest()}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Entrando…' : 'Continuar como invitada'}
            </Button>
            <p data-testid="onboarding_guest_deletion_notice" className="text-center text-body-sm text-tertiary">
              Como invitada, tu progreso se borra a los 3 días si no creas una cuenta.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p data-testid="onboarding_identity_error_message" role="alert" aria-live="assertive" className="mt-4 text-body-sm text-error">
          {error}
        </p>
      )}
    </Card>
  );
}
