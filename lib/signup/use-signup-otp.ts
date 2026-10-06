import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { translateAuthError } from '@/lib/auth-errors';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { createClient } from '@/lib/supabase/client';

interface UseSignupOtpArgs {
  email: string
  password: string
  setEmailConflict: (value: boolean) => void
  setNavigating: (value: boolean) => void
}

/**
 * FRESCO-89: Supabase requires the anonymous user's email to be verified
 * before it can be linked (docs: "Convert an anonymous user to a
 * permanent user" — updateUser({ email }) then, only after verification,
 * updateUser({ password })). This project has secure email change ON
 * (`mailer_secure_email_change_enabled`), so the single-call
 * `updateUser({ email, password })` used to silently queue a pending
 * change instead of applying it — login with the "created" account failed
 * forever if the guest session was ever lost.
 */
export function useSignupOtp({ email, password, setEmailConflict, setNavigating }: UseSignupOtpArgs) {
  const router = useRouter();
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  /**
   * FRESCO-89, step 2 of the anonymous-conversion flow: her email is only
   * linked once the OTP is verified — only then does Supabase allow the
   * password to be set on the (now-linked) identity.
   *
   * `email_exists` is checked HERE, not at the step-1 `updateUser({ email })`
   * call: verified live that a pending change queues (200, no error) even
   * when the target email already belongs to another confirmed account —
   * same anti-enumeration behavior the plain `signUp` path documents. The
   * conflict only surfaces once Supabase tries to actually commit the swap,
   * i.e. here.
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
      // FRESCO-204: same Router Cache staleness risk as the reassign path —
      // bust it before returning to /menu.
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

  return { otpCode, setOtpCode, otpError, isVerifyingOtp, isResendingOtp, resendMessage, handleVerifyOtp, handleResendOtp };
}
