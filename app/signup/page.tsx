'use client';

import type { FormEvent } from 'react';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import Image from 'next/image';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { CaptchaField } from '@/components/auth/captcha-field';
import { AuthTransitionOverlay } from '@/components/layout/auth-transition-overlay';
import { ConsentCheckboxes } from '@/components/legal/consent-checkboxes';
import { LegalLinks } from '@/components/legal/legal-links';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { EdgeFunctionError, reassignGuestData } from '@/lib/api/edge-functions';
import { translateAuthError } from '@/lib/auth-errors';
import { captchaOptions } from '@/lib/auth/captcha';
import { useCaptcha } from '@/lib/auth/use-captcha';
import { clientEnv } from '@/lib/env';
import { CONSENT_PENDING_KEY, postConsents, REGISTRATION_CONSENTS } from '@/lib/legal/consent-client';
import { getDistinctId } from '@/lib/posthog/distinct-id';
import { aliasUser, captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { createClient } from '@/lib/supabase/client';

import { isPasswordTooShort, PASSWORD_TOO_SHORT_MESSAGE } from '@/lib/validation/password-policy';
import { isPasswordPwned, PWNED_PASSWORD_MESSAGE } from '@/lib/validation/pwned-password';

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
  // FRESCO-482: set right before any `router.push` to a post-auth screen —
  // mounts a full-screen cover so the wait for `/menu` / `/onboarding` reads
  // as "working", not "the button did nothing". Never cleared; the page
  // unmounts on navigation.
  const [navigating, setNavigating] = useState(false);
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
  // FRESCO-53: the Terms / Privacy checkbox row. FRESCO-794 moved its markup and
  // its `LegalModal` into `ConsentCheckboxes` (shared with the onboarding
  // identity step); only the checked state and the error live here.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  // FRESCO-794 (ADR-0040): age 14+ confirmation, never pre-ticked.
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [ageError, setAgeError] = useState<string | null>(null);
  // FRESCO-114: see login/page.tsx — a ref guard catches a synchronous
  // double-click that `disabled={isSubmitting}` alone misses.
  const isSubmittingRef = useRef(false);
  // FRESCO-799: one Turnstile token per auth request; reset after each.
  const captcha = useCaptcha();

  /**
   * ADR-0004 (FRESCO-20) + ADR-0022 (FRESCO-395 / A4-L4): the guest proves
   * she owns the conflicting account by authenticating to it through native
   * Supabase Auth; `reassign-guest-data` then only verifies the resulting
   * session token, never a password. The proof sign-in runs on a throwaway
   * in-memory client (`persistSession: false`) so the guest session on the
   * main client stays live until the data move is done — that anonymous
   * identity is what gets reassigned away — and only then is the main client
   * switched over to the real account.
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

      // Ownership proof against native Supabase Auth (its own rate limiting +
      // leaked-password protection) on a client kept out of storage, so the
      // guest session above is untouched.
      const proofClient = createSupabaseClient(
        clientEnv.NEXT_PUBLIC_SUPABASE_URL,
        clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data: proofData, error: proofError } = await proofClient.auth.signInWithPassword({
        email,
        password: conflictPassword,
        options: captchaOptions(captcha.token),
      });
      captcha.reset();
      if (proofError || !proofData.session) {
        setReassignError(translateAuthError(proofError));
        return;
      }

      await reassignGuestData(
        { targetAccessToken: proofData.session.access_token },
        session.access_token,
      );

      // FRESCO-240 (ADR-0013): capture the anonymous distinct_id BEFORE
      // signInWithPassword below switches the session to the pre-existing
      // account's auth.uid() -- once it resolves, the provider's
      // onAuthStateChange has already re-identified under the new uid and
      // this anonymous id is gone.
      const anonymousDistinctId = getDistinctId();

      // FRESCO-799: switch the main client to the account the proof sign-in just
      // authenticated by adopting that session, not by a second password
      // sign-in — a Turnstile token is single-use, so a second sign-in would
      // need a second challenge for the same proof.
      const { data: signInData, error } = await client.auth.setSession({
        access_token: proofData.session.access_token,
        refresh_token: proofData.session.refresh_token,
      });
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
      captureEvent(POSTHOG_EVENTS.USER_SIGNED_UP, { method: 'progressive_signup_reassign', $set_once: { signup_method: 'progressive_signup_reassign' } });
      // FRESCO-204: she may have browsed /menu as the anonymous guest
      // earlier in this session — Next's client Router Cache can otherwise
      // serve that stale (is_anonymous: true) RSC payload instead of
      // refetching, showing the "create an account" banner right after she
      // just did. `router.refresh()` busts it, same pattern used elsewhere
      // in this app after server state changes.
      router.refresh();
      setNavigating(true);
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
        // FRESCO-390 (A4-M25): a genuine verification failure (wrong / expired
        // code) — NOT the email_exists conflict above, which is a different
        // funnel. `reason` is the Supabase error code (e.g. `otp_expired`).
        captureEvent(POSTHOG_EVENTS.OTP_FAILED, { reason: verifyError.code });
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
      // FRESCO-390 (A4-M25): the code was valid and the email is now linked —
      // the funnel step that closes `otp_sent`. Fired alongside
      // `user_signed_up` below (not instead of it): this one is the granular
      // OTP-deliverability metric, that one is "a real account exists".
      captureEvent(POSTHOG_EVENTS.OTP_VERIFIED);
      // ADR-0013 (FRESCO-240): EPIC-FRESCO-7's Progressive Signup conversion
      // completing — the OTP-based anonymous→registered path. Mutually
      // exclusive with identity-step.tsx's own USER_SIGNED_UP capture (that
      // one only fires for a brand-new visitor choosing "crear cuenta" at
      // /onboarding, which never reaches /signup afterward), so no
      // double-count guard is needed — `method` just distinguishes entry
      // point for anyone reading the funnel later.
      captureEvent(POSTHOG_EVENTS.USER_SIGNED_UP, { method: 'progressive_signup_otp', $set_once: { signup_method: 'progressive_signup_otp' } });
      // She already has a profile + generated menu — back to it, not onboarding.
      // FRESCO-204: same Router Cache staleness risk as `handleReassign`
      // above — bust it before returning to /menu.
      router.refresh();
      setNavigating(true);
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
      // FRESCO-390 (A4-M25): a resend is another delivery attempt — a high
      // `resend` rate is itself a deliverability signal (first email lost).
      captureEvent(POSTHOG_EVENTS.OTP_SENT, { context: 'resend' });
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
    setAgeError(null);
    setSignupError(null);
    if (!ageConfirmed || !acceptedTerms) {
      setAgeError(ageConfirmed ? null : 'Confirma que tienes 14 años o más para continuar.');
      setTermsError(acceptedTerms ? null : 'Debes aceptar los Términos de Servicio y la Política de Privacidad para continuar.');
      return;
    }
    // FRESCO-123: reject a weak password before the anonymous-conversion
    // branch fires its real OTP email — without this, she pays the full
    // email round-trip only to discover the password was rejected all
    // along. Mirrors the server-side `minimum_password_length` (FRESCO-363 /
    // A4-H8, `lib/validation/password-policy.ts`) so the message is never a
    // surprise later.
    if (isPasswordTooShort(password)) {
      setSignupError(PASSWORD_TOO_SHORT_MESSAGE);
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    // FRESCO-32: reject a known-breached password before the real signUp /
    // anonymous-conversion call. Runs with the button disabled (the HIBP
    // request can take up to 3s). Fail-open — a HIBP outage never blocks.
    if (await isPasswordPwned(password)) {
      setSignupError(PWNED_PASSWORD_MESSAGE);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }
    setEmailConflict(false);
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();

      // FRESCO-19 (Progressive Signup, US 7.1): a guest arrives here with an
      // active anonymous session (ADR-0003) — converting it via `updateUser`
      // preserves the same `user_id`, so the menu she already generated
      // stays hers. `signUp` would create an unrelated new user instead.
      if (user?.is_anonymous) {
        // FRESCO-794: the guest session exists, so the consents are recorded now,
        // before anything changes. A failure here changes nothing and can be retried.
        if (!(await postConsents(REGISTRATION_CONSENTS))) {
          setSignupError('No pudimos registrar tu aceptación. Inténtalo de nuevo.');
          return;
        }
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
        // FRESCO-390 (A4-M25): the OTP email is on its way — first send of
        // the conversion funnel. `otp_verified / otp_sent` measures the
        // Gmail-SMTP deliverability the audit flagged (ADR-0021).
        captureEvent(POSTHOG_EVENTS.OTP_SENT, { context: 'initial' });
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
        options: {
          ...captchaOptions(captcha.token),
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
          // FRESCO-794: usually no session yet (email confirmation), so the
          // consents wait in the metadata and `/onboarding` records them on the
          // first signed-in visit (`flushPendingConsents`).
          data: { [CONSENT_PENDING_KEY]: REGISTRATION_CONSENTS },
        },
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
      setNavigating(true);
      router.push('/onboarding');
    }
    finally {
      captcha.reset();
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-start px-4 pb-4 pt-[clamp(0.75rem,4vh,6rem)]">
      {navigating && <AuthTransitionOverlay label="Preparando tu cuenta…" />}
      {/* FRESCO-481: cream negative mark on the near-black dark ground. */}
      <Image src="/brand/logo-base.svg" alt="Fresco" width={112} height={34} className="mx-auto mb-[clamp(0.75rem,3vh,2rem)] brand-mark--light" priority />
      <Image src="/brand/logo-negativo.svg" alt="Fresco" width={112} height={34} className="mx-auto mb-[clamp(0.75rem,3vh,2rem)] brand-mark--dark" priority />

      <Card className="p-6 md:p-8 md:[@media(max-height:700px)]:p-6">
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
                  <label htmlFor="conflict-password" className="sr-only">Contraseña de esa cuenta</label>
                  <Input
                    id="conflict-password"
                    data-testid="conflict_password_input"
                    type="password"
                    placeholder="Contraseña de esa cuenta"
                    autoComplete="current-password"
                    value={conflictPassword}
                    onChange={e => setConflictPassword(e.target.value)}
                  />
                  <CaptchaField captcha={captcha} />
                  <Button
                    data-testid="signup_reassign_button"
                    type="submit"
                    variant="secondary"
                    disabled={isReassigning || !conflictPassword || !captcha.ready}
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
                      {/* FRESCO-315: real <label for> instead of an aria-label
                          that only duplicated the placeholder (WCAG 3.3.2 /
                          4.1.2). sr-only keeps the card design unchanged. */}
                      <label htmlFor="signup-email" className="sr-only">Correo electrónico</label>
                      <Input
                        id="signup-email"
                        data-testid="email_input"
                        type="email"
                        placeholder="Correo electrónico"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                      {/* FRESCO-448 (S9): was a bare <Input> — the highest-
                          traffic signup path had the weakest password field
                          (no show/hide, no strength meter, no policy hint,
                          and a native minLength bubble). Now matches the
                          onboarding "Crear cuenta" field. */}
                      <PasswordInput
                        value={password}
                        onChange={setPassword}
                        data-testid="password_input"
                        autoComplete="new-password"
                        showPolicyHint
                      />
                      <ConsentCheckboxes
                        ageConfirmed={ageConfirmed}
                        termsAccepted={acceptedTerms}
                        onAgeChange={setAgeConfirmed}
                        onTermsChange={setAcceptedTerms}
                        ageError={ageError}
                        termsError={termsError}
                      />

                      <CaptchaField captcha={captcha} />
                      <Button data-testid="signup_submit_button" type="submit" className="mt-2" disabled={isSubmitting || !captcha.ready}>
                        {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
                      </Button>
                    </form>

                    {signupError && (
                      <p data-testid="signup_error_message" role="alert" aria-live="assertive" className="mt-4 text-body-sm text-error">
                        {signupError}
                      </p>
                    )}

                    <p className="mt-4 text-center text-body-sm text-tertiary">
                      ¿Ya tienes cuenta?
                      {' '}
                      {/* FRESCO-499: underline distinguishes this inline link from
                          the surrounding text without relying on color alone
                          (axe link-in-text-block), matching the underline already
                          used for the Términos/Privacidad in-text links below. */}
                      <Link href="/login" className="text-primary underline">
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
