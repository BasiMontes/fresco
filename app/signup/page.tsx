'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useCaptcha } from '@/components/auth/use-captcha';
import { AuthTransitionOverlay } from '@/components/layout/auth-transition-overlay';
import { LegalLinks } from '@/components/legal/legal-links';
import { SignupEmailConflict } from '@/components/signup/signup-email-conflict';
import { SignupFormStep } from '@/components/signup/signup-form-step';
import { SignupOtpStep } from '@/components/signup/signup-otp-step';
import { SignupPendingConfirmation } from '@/components/signup/signup-pending-confirmation';
import { useSignupOtp } from '@/components/signup/use-signup-otp';
import { useSignupReassign } from '@/components/signup/use-signup-reassign';
import { useSignupSubmit } from '@/components/signup/use-signup-submit';
import { Card } from '@/components/ui/card';

/**
 * `/signup` — EPIC-FRESCO-7 (Progressive Signup, US 7.1): a guest is asked
 * to sign up only AFTER seeing a generated menu (user-journeys.md Journey 1,
 * Step 5 — "keep what you just saw", not a paywall).
 *
 * FRESCO-809 — the page only owns the state machine (which step shows) and the
 * fields shared across steps; each step's logic lives in `components/signup/
 * use-signup-*.ts` and its markup in the matching `signup-*` component.
 */
export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailConflict, setEmailConflict] = useState(false);
  // FRESCO-190: set once `signUp()` succeeded without a session (email
  // confirmation required), so she sees "check your email" and stays here.
  const [signupPendingConfirmation, setSignupPendingConfirmation] = useState(false);
  // FRESCO-482: set right before any `router.push` to a post-auth screen —
  // mounts a full-screen cover so the wait for `/menu` / `/onboarding` reads
  // as "working", not "the button did nothing". Never cleared; the page
  // unmounts on navigation.
  const [navigating, setNavigating] = useState(false);
  // FRESCO-89: the anonymous-conversion flow links the email through an OTP step.
  const [step, setStep] = useState<'form' | 'otp'>('form');
  // FRESCO-799: one Turnstile token per auth request; reset after each.
  const captcha = useCaptcha();

  const reassign = useSignupReassign({ email, captcha, setNavigating });
  const otp = useSignupOtp({ email, password, setEmailConflict, setNavigating });
  const submit = useSignupSubmit({ email, password, captcha, setEmailConflict, setStep, setSignupPendingConfirmation, setNavigating });

  let content;
  if (emailConflict) {
    content = <SignupEmailConflict reassign={reassign} captcha={captcha} />;
  }
  else if (signupPendingConfirmation) {
    content = <SignupPendingConfirmation email={email} />;
  }
  else if (step === 'form') {
    content = <SignupFormStep email={email} password={password} onEmailChange={setEmail} onPasswordChange={setPassword} submit={submit} captcha={captcha} />;
  }
  else {
    content = <SignupOtpStep email={email} otp={otp} />;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-start px-4 pb-4 pt-[clamp(0.75rem,4vh,6rem)]">
      {navigating && <AuthTransitionOverlay label="Preparando tu cuenta…" />}
      {/* FRESCO-481: cream negative mark on the near-black dark ground. */}
      <Image src="/brand/logo-base.svg" alt="Fresco" width={112} height={34} className="mx-auto mb-[clamp(0.75rem,3vh,2rem)] brand-mark--light" priority />
      <Image src="/brand/logo-negativo.svg" alt="Fresco" width={112} height={34} className="mx-auto mb-[clamp(0.75rem,3vh,2rem)] brand-mark--dark" priority />

      <Card className="p-6 md:p-8 md:[@media(max-height:700px)]:p-6">
        {content}
      </Card>

      <LegalLinks />
    </div>
  );
}
