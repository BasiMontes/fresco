import type { FormEvent } from 'react';
import type { useCaptcha } from '@/components/auth/use-captcha';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { translateAuthError } from '@/lib/auth-errors';
import { getCurrentUser, requestEmailChange, signUp } from '@/lib/client-api/auth';
import { CONSENT_PENDING_KEY, postConsents, REGISTRATION_CONSENTS } from '@/lib/legal/consent-client';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { isPasswordTooShort, PASSWORD_TOO_SHORT_MESSAGE } from '@/lib/validation/password-policy';
import { isPasswordPwned, PWNED_PASSWORD_MESSAGE } from '@/lib/validation/pwned-password';

interface UseSignupSubmitArgs {
  email: string
  password: string
  captcha: ReturnType<typeof useCaptcha>
  setEmailConflict: (value: boolean) => void
  setStep: (step: 'form' | 'otp') => void
  setSignupPendingConfirmation: (value: boolean) => void
  setNavigating: (value: boolean) => void
}

/** The first-step submit of `/signup`: consent checks, password policy, then guest conversion or a brand-new `signUp`. */
export function useSignupSubmit({ email, password, captcha, setEmailConflict, setStep, setSignupPendingConfirmation, setNavigating }: UseSignupSubmitArgs) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
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

  /**
   * FRESCO-19 (Progressive Signup, US 7.1): a guest arrives here with an
   * active anonymous session (ADR-0003) — converting it via `updateUser`
   * preserves the same `user_id`, so the menu she already generated
   * stays hers. `signUp` would create an unrelated new user instead.
   */
  async function convertGuestToAccount() {
    // FRESCO-794: the guest session exists, so the consents are recorded now,
    // before anything changes. A failure here changes nothing and can be retried.
    if (!(await postConsents(REGISTRATION_CONSENTS))) {
      setSignupError('No pudimos registrar tu aceptación. Inténtalo de nuevo.');
      return;
    }
    // FRESCO-89: only link the email here — the password is set after
    // she verifies it (see `useSignupOtp`). Sending both together
    // used to return a false 200 (change queued, never applied).
    const { error } = await requestEmailChange(email);
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
  }

  async function registerNewAccount() {
    const { data, error } = await signUp({
      email,
      password,
      captchaToken: captcha.token,
      // FRESCO-264 — must route through /auth/confirm (this env's own
      // domain), not a bare path. Supabase's mailer template builds the
      // confirmation link's domain from this value ({{ .RedirectTo }}),
      // not from Auth's global Site URL — which stays fixed to production
      // even for staging signups. See app/auth/confirm/route.ts.
      emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
      // FRESCO-794: usually no session yet (email confirmation), so the
      // consents wait in the metadata and `/onboarding` records them on the
      // first signed-in visit (`flushPendingConsents`).
      metadata: { [CONSENT_PENDING_KEY]: REGISTRATION_CONSENTS },
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
    // guest-conversion email-conflict path: this visitor has no
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
      const user = await getCurrentUser();

      if (user?.is_anonymous) {
        await convertGuestToAccount();
        return;
      }
      await registerNewAccount();
    }
    finally {
      captcha.reset();
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return {
    isSubmitting,
    signupError,
    ageConfirmed,
    setAgeConfirmed,
    ageError,
    acceptedTerms,
    setAcceptedTerms,
    termsError,
    handleSubmit,
  };
}
