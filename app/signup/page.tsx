'use client';

import type { FormEvent } from 'react';
import type { LegalSection } from '@/components/legal/legal-modal';
import Image from 'next/image';
import Link from 'next/link';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { LegalLinks } from '@/components/legal/legal-links';
import { LegalModal } from '@/components/legal/legal-modal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EdgeFunctionError, reassignGuestData } from '@/lib/api/edge-functions';
import { translateAuthError } from '@/lib/auth-errors';
import { aliasUser, captureEvent, getDistinctId, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { useOnboardingStore } from '@/lib/store/onboarding-store';

import { createClient } from '@/lib/supabase/client';

/**
 * `/signup` — EPIC-FRESCO-7 (Progressive Signup, US 7.1): a guest is asked
 * to sign up only AFTER seeing a generated menu (user-journeys.md Journey 1,
 * Step 5 — "keep what you just saw", not a paywall).
 */
export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [emailConflict, setEmailConflict] = useState(false);
  const [conflictPassword, setConflictPassword] = useState('');
  // FRESCO-190: this project requires email confirmation, so `signUp()`
  // succeeds without establishing a session. Set once that's confirmed, so
  // she sees a clear "check your email" state instead of being redirected
  // to /onboarding, where `ensureGuestSession()` would otherwise find no
  // session and silently create a disconnected anonymous guest.
  const [signupPendingConfirmation, setSignupPendingConfirmation] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  // FRESCO-89: Supabase requires the anonymous user's email to be verified
  // before it can be linked (docs: "Convert an anonymous user to a
  // permanent user" — updateUser({ email }) then, only after verification,
  // updateUser({ password })). This project has secure email change ON
  // (`mailer_secure_email_change_enabled`), so the single-call
  // `updateUser({ email, password })` used to silently queue a pending
  // change instead of applying it — login with the "created" account failed
  // forever if the guest session was ever lost.
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  // FRESCO-53: reuses FRESCO-51's `LegalModal` directly (not `LegalLinks` —
  // this owns its own open/section state so a link inside the checkbox
  // row can deep-link straight to the relevant document).
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalSection, setLegalModalSection] = useState<LegalSection>('terminos');
  // FRESCO-114: see login/page.tsx — a ref guard catches a synchronous
  // double-click that `disabled={isSubmitting}` alone misses.
  const isSubmittingRef = useRef(false);

  /**
   * ADR-0004 (FRESCO-20): the guest proves she owns the conflicting account
   * by its real password (verified server-side, never trusted client-side),
   * then her generated data moves to it. Runs on the STILL-anonymous
   * session's access token — that identity is what gets reassigned away.
   */
  async function handleReassign() {
    setIsReassigning(true);
    setReassignError(null);
    try {
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        setReassignError('Tu sesión de invitada expiró. Recarga la página e inténtalo de nuevo.');
        return;
      }

      await reassignGuestData({ email, password: conflictPassword }, session.access_token);

      // FRESCO-240 (ADR-0013): capture the anonymous distinct_id BEFORE
      // signInWithPassword below switches the session to the pre-existing
      // account's auth.uid() -- once it resolves, the provider's
      // onAuthStateChange has already re-identified under the new uid and
      // this anonymous id is gone.
      const anonymousDistinctId = getDistinctId();

      const { data: signInData, error } = await client.auth.signInWithPassword({ email, password: conflictPassword });
      if (error) {
        setReassignError(translateAuthError(error));
        return;
      }
      // Merges the guest's pre-reassignment event stream (menu generation
      // included) into the account she just proved she owns -- identify()
      // alone can't do this, since the uid actually changes here, unlike the
      // OTP conversion path below which keeps the same uid throughout.
      if (anonymousDistinctId && signInData.user) {
        aliasUser(signInData.user.id, anonymousDistinctId);
      }
      captureEvent(POSTHOG_EVENTS.USER_SIGNED_UP, { method: 'progressive_signup_reassign' });
      // FRESCO-204: she may have browsed /menu as the anonymous guest
      // earlier in this session — Next's client Router Cache can otherwise
      // serve that stale (is_anonymous: true) RSC payload instead of
      // refetching, showing the "create an account" banner right after she
      // just did. `router.refresh()` busts it, same pattern used elsewhere
      // in this app after server state changes.
      router.refresh();
      router.push('/menu');
    }
    catch (err) {
      setReassignError(
        err instanceof EdgeFunctionError
          ? err.message
          : 'No pudimos verificar esa cuenta. Inténtalo de nuevo.',
      );
    }
    finally {
      setIsReassigning(false);
    }
  }

  /**
   * FRESCO-89, step 2 of the anonymous-conversion flow: her email is only
   * linked once the OTP is verified — only then does Supabase allow the
   * password to be set on the (now-linked) identity.
   *
   * `email_exists` is checked HERE, not at the step-1 `updateUser({ email })`
   * call: verified live that a pending change queues (200, no error) even
   * when the target email already belongs to another confirmed account —
   * same anti-enumeration behavior this file already documents for the
   * plain `signUp` path above. The conflict only surfaces once Supabase
   * tries to actually commit the swap, i.e. here.
   */
  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const client = createClient();
      const { error: verifyError } = await client.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email_change',
      });
      if (verifyError) {
        if (verifyError.code === 'email_exists') {
          setEmailConflict(true);
          return;
        }
        setOtpError(translateAuthError(verifyError));
        return;
      }
      const { error: passwordError } = await client.auth.updateUser({ password });
      if (passwordError) {
        if (passwordError.code === 'email_exists') {
          setEmailConflict(true);
          return;
        }
        setOtpError(translateAuthError(passwordError));
        return;
      }
      // ADR-0013 (FRESCO-240): EPIC-FRESCO-7's Progressive Signup conversion
      // completing — the OTP-based anonymous→registered path. Mutually
      // exclusive with identity-step.tsx's own USER_SIGNED_UP capture (that
      // one only fires for a brand-new visitor choosing "crear cuenta" at
      // /onboarding, which never reaches /signup afterward), so no
      // double-count guard is needed — `method` just distinguishes entry
      // point for anyone reading the funnel later.
      captureEvent(POSTHOG_EVENTS.USER_SIGNED_UP, { method: 'progressive_signup_otp' });
      // She already has a profile + generated menu — back to it, not onboarding.
      // FRESCO-204: same Router Cache staleness risk as `handleReassign`
      // above — bust it before returning to /menu.
      router.refresh();
      router.push('/menu');
    }
    finally {
      setIsVerifyingOtp(false);
    }
  }

  async function handleResendOtp() {
    setIsResendingOtp(true);
    setOtpError(null);
    setResendMessage(null);
    try {
      const client = createClient();
      const { error } = await client.auth.updateUser({ email });
      if (error) {
        setOtpError(translateAuthError(error));
        return;
      }
      setResendMessage('Te enviamos un nuevo código.');
    }
    finally {
      setIsResendingOtp(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingRef.current) { return; }
    setTermsError(null);
    setSignupError(null);
    if (!acceptedTerms) {
      setTermsError('Debes aceptar los Términos de Servicio y la Política de Privacidad para continuar.');
      return;
    }
    // FRESCO-123: reject a weak password before the anonymous-conversion
    // branch fires its real OTP email — without this, she pays the full
    // email round-trip only to discover the password was rejected all
    // along. Mirrors Supabase's own `weak_password` threshold (see
    // `lib/auth-errors.ts`) so the message is never a surprise later.
    if (password.length < 6) {
      setSignupError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setEmailConflict(false);
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();

      // FRESCO-19 (Progressive Signup, US 7.1): a guest arrives here with an
      // active anonymous session (ADR-0003) — converting it via `updateUser`
      // preserves the same `user_id`, so the menu she already generated
      // stays hers. `signUp` would create an unrelated new user instead.
      if (user?.is_anonymous) {
        // FRESCO-89: only link the email here — the password is set after
        // she verifies it (see `handleVerifyOtp`). Sending both together
        // used to return a false 200 (change queued, never applied).
        const { error } = await client.auth.updateUser({ email });
        if (error) {
          if (error.code === 'email_exists') {
            // AC (edge case): the email belongs to a different, existing
            // account — this must not fail silently nor discard her guest
            // session as if it worked. Real data reassignment to that
            // account is tracked as a separate tech-story (ADR-0003 names
            // this exact branch as a known open risk); for now she's told
            // clearly and pointed at the account she already has.
            setEmailConflict(true);
          }
          else {
            setSignupError(translateAuthError(error));
          }
          return;
        }
        setStep('otp');
        return;
      }

      const { data, error } = await client.auth.signUp({
        email,
        password,
        // FRESCO-264 — must route through /auth/confirm (this env's own
        // domain), not a bare path. Supabase's mailer template builds the
        // confirmation link's domain from this value ({{ .RedirectTo }}),
        // not from Auth's global Site URL — which stays fixed to production
        // even for staging signups. See app/auth/confirm/route.ts.
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding` },
      });
      if (error) {
        setSignupError(translateAuthError(error));
        return;
      }
      // Supabase's documented anti-enumeration behavior: signing up with an
      // email that already belongs to a confirmed account returns 200 with
      // no error — an obfuscated user object, empty `identities`, and no
      // session — instead of a normal error. Without this check the visitor
      // silently landed on /onboarding with no session at all, a dead end
      // that only surfaced as a bare 401 later. Not the same UI as the
      // guest-conversion email-conflict path below: this visitor has no
      // anonymous session to reassign data from, just a plain "log in
      // instead" pointer.
      if (data.user?.identities?.length === 0) {
        setSignupError('Ya existe una cuenta con ese email. Inicia sesión en su lugar.');
        return;
      }
      // FRESCO-190: `signUp()` above returns 200 the moment the account is
      // created, regardless of whether Supabase actually issued a session —
      // this project requires email confirmation, so it normally does NOT.
      // Redirecting to /onboarding unconditionally used to let its
      // `ensureGuestSession()` effect find no session and silently create a
      // disconnected anonymous guest, masking that her real account was
      // still sitting unconfirmed. Only the exceptional case (Supabase did
      // return a session — e.g. if email confirmation is ever disabled)
      // continues into onboarding; otherwise she gets a clear "check your
      // email" state and stays right here.
      if (!data.session) {
        setSignupPendingConfirmation(true);
        return;
      }
      // FRESCO-150: sessionStorage isn't scoped per-account — clear any
      // draft left by a previous session in this same browser tab before
      // this brand-new account starts its own onboarding.
      useOnboardingStore.getState().reset();
      // New users always go through onboarding next — see FRESCO-1.
      router.push('/onboarding');
    }
    finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Image src="/brand/logo-base.svg" alt="Fresco" width={112} height={34} className="mx-auto mb-8" priority />

      <Card className="p-6 md:p-8">
        {emailConflict
          ? (
              <>
                <h1 className="text-h3">Ya existe una cuenta con ese email</h1>
                <p data-testid="signup_email_conflict_message" role="alert" aria-live="assertive" className="mt-1 text-body-sm text-tertiary">
                  Ingresa su contraseña para continuar con ella y conservar el menú que acabas de generar.
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleReassign();
                  }}
                  className="mt-6 flex flex-col gap-3"
                >
                  <Input
                    data-testid="conflict_password_input"
                    type="password"
                    placeholder="Contraseña de esa cuenta"
                    aria-label="Contraseña de esa cuenta"
                    autoComplete="current-password"
                    value={conflictPassword}
                    onChange={e => setConflictPassword(e.target.value)}
                  />
                  <Button
                    data-testid="signup_reassign_button"
                    type="submit"
                    variant="secondary"
                    disabled={isReassigning || !conflictPassword}
                  >
                    {isReassigning ? 'Verificando…' : 'Continuar con esta cuenta'}
                  </Button>
                </form>
                {reassignError && (
                  <p data-testid="signup_reassign_error_message" role="alert" aria-live="assertive" className="mt-3 text-body-sm text-error">
                    {reassignError}
                  </p>
                )}
                <p className="mt-4 text-center text-body-sm text-tertiary">
                  o
                  {' '}
                  <Link href="/login" className="text-primary">
                    inicia sesión manualmente
                  </Link>
                </p>
              </>
            )
          : signupPendingConfirmation
            ? (
                <>
                  <h1 className="text-h3">Revisa tu correo</h1>
                  <p data-testid="signup_confirmation_pending_message" role="status" aria-live="polite" className="mt-1 text-body-sm text-tertiary">
                    Te enviamos un enlace de confirmación a
                    {' '}
                    <strong>{email}</strong>
                    . Ábrelo para activar tu cuenta y luego inicia sesión.
                  </p>
                  <p className="mt-4 text-center text-body-sm text-tertiary">
                    <Link href="/login" className="text-primary">
                      Ir a iniciar sesión
                    </Link>
                  </p>
                </>
              )
            : step === 'form'
              ? (
                  <>
                    <h1 className="text-h3">Guarda tu menú</h1>
                    <p className="mt-1 text-body-sm text-tertiary">
                      Crea una cuenta para no perder el menú que acabamos de generar.
                    </p>

                    <form onSubmit={event => void handleSubmit(event)} className="mt-6 flex flex-col gap-3">
                      <Input
                        data-testid="email_input"
                        type="email"
                        placeholder="Correo electrónico"
                        aria-label="Correo electrónico"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                      <Input
                        data-testid="password_input"
                        type="password"
                        placeholder="Contraseña"
                        aria-label="Contraseña"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                      <label className="mt-1 flex cursor-pointer items-start gap-2 text-body-sm text-tertiary">
                        <span className="flex size-6 shrink-0 items-center justify-center">
                          <input
                            type="checkbox"
                            data-testid="accept_terms_checkbox"
                            checked={acceptedTerms}
                            onChange={e => setAcceptedTerms(e.target.checked)}
                            className="size-4 accent-primary"
                          />
                        </span>
                        <span>
                          Al crear una cuenta, aceptas nuestros
                          {' '}
                          <button
                            type="button"
                            data-testid="accept_terms_link_terminos"
                            onClick={() => {
                              setLegalModalSection('terminos');
                              setLegalModalOpen(true);
                            }}
                            className="text-primary underline"
                          >
                            Términos de Servicio
                          </button>
                          {' '}
                          y nuestra
                          {' '}
                          <button
                            type="button"
                            data-testid="accept_terms_link_privacidad"
                            onClick={() => {
                              setLegalModalSection('privacidad');
                              setLegalModalOpen(true);
                            }}
                            className="text-primary underline"
                          >
                            Política de Privacidad
                          </button>
                          .
                        </span>
                      </label>

                      {termsError && (
                        <p data-testid="accept_terms_error_message" role="alert" aria-live="assertive" className="text-body-sm text-error">
                          {termsError}
                        </p>
                      )}

                      <Button data-testid="signup_submit_button" type="submit" className="mt-2" disabled={isSubmitting}>
                        {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
                      </Button>
                    </form>

                    <LegalModal
                      open={legalModalOpen}
                      onOpenChange={setLegalModalOpen}
                      section={legalModalSection}
                    />

                    {signupError && (
                      <p data-testid="signup_error_message" role="alert" aria-live="assertive" className="mt-4 text-body-sm text-error">
                        {signupError}
                      </p>
                    )}

                    <p className="mt-4 text-center text-body-sm text-tertiary">
                      ¿Ya tienes cuenta?
                      {' '}
                      <Link href="/login" className="text-primary">
                        Inicia sesión
                      </Link>
                    </p>
                  </>
                )
              : (
                  <>
                    <h1 className="text-h3">Revisa tu correo</h1>
                    <p className="mt-1 text-body-sm text-tertiary">
                      Te enviamos un código a
                      {' '}
                      <strong>{email}</strong>
                      . Ingrésalo para confirmar tu cuenta.
                    </p>

                    <form onSubmit={event => void handleVerifyOtp(event)} className="mt-6 flex flex-col gap-3">
                      <Input
                        data-testid="otp_code_input"
                        type="text"
                        inputMode="numeric"
                        placeholder="Código de 6 dígitos"
                        aria-label="Código de verificación"
                        required
                        pattern="\d{6}"
                        maxLength={6}
                        autoComplete="one-time-code"
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value)}
                      />

                      {otpError && (
                        <p data-testid="signup_otp_error_message" role="alert" aria-live="assertive" className="text-body-sm text-error">
                          {otpError}
                        </p>
                      )}

                      {resendMessage && (
                        <p data-testid="signup_otp_resend_message" role="status" aria-live="polite" className="text-body-sm text-tertiary">
                          {resendMessage}
                        </p>
                      )}

                      <Button data-testid="signup_verify_otp_button" type="submit" className="mt-2" disabled={isVerifyingOtp || otpCode.length !== 6}>
                        {isVerifyingOtp ? 'Verificando…' : 'Confirmar código'}
                      </Button>

                      <button
                        type="button"
                        data-testid="signup_resend_otp_button"
                        onClick={() => void handleResendOtp()}
                        disabled={isResendingOtp}
                        className="text-center text-body-sm text-primary underline"
                      >
                        {isResendingOtp ? 'Reenviando…' : '¿No te llegó? Reenviar código'}
                      </button>
                    </form>
                  </>
                )}
      </Card>

      <LegalLinks />
    </div>
  );
}
