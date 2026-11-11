'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { CaptchaField } from '@/components/auth/captcha-field';
import { useCaptcha } from '@/components/auth/use-captcha';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmailInput } from '@/components/ui/email-input';
import { isCaptchaConfigured } from '@/lib/auth/captcha';
import { joinWaitlist } from '@/lib/client-api/waitlist';
import { WAITLIST_CONSENT_TEXT } from '@/lib/legal/waitlist-text';

type Status = 'idle' | 'sending' | 'joined' | 'error';

/**
 * FRESCO-888 — early-interest form under the final CTA: one email and one
 * explicit, unticked consent. The consent is recorded server-side with the
 * version of the text (`POST /api/waitlist`). FRESCO-1008: that only registers a PENDING signup; the address is added once its owner confirms from the email we send. The submit stays disabled until the
 * box is ticked, so a visitor cannot join without having consented.
 * FRESCO-1103: when the build carries a Turnstile site key the submit also waits for the check, and the token travels with the request.
 * FRESCO-1190: the check starts only when the visitor first touches the form. This form sits on the landing page,
 * so loading Cloudflare's script on mount sent the IP and browser data of EVERY visitor to Cloudflare, before they
 * had decided on cookies and without doing anything, while the privacy policy says Turnstile acts when signing in or
 * signing up. Now it loads when somebody starts to fill in the form (focus or input, which also covers autofill).
 */
export function WaitlistForm({ captchaConfigured = isCaptchaConfigured() }: { captchaConfigured?: boolean } = {}) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [touched, setTouched] = useState(false);
  const captcha = useCaptcha(captchaConfigured && touched);
  // Not `!captcha.ready`: before the first touch the captcha is off, which reads as "ready". With a site key
  // configured, nobody submits without a token, and a token needs the touch that started the check.
  const waitingForCaptcha = captchaConfigured && captcha.token === null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    const joined = await joinWaitlist(email.trim(), captcha.token);
    captcha.reset();
    setStatus(joined ? 'joined' : 'error');
  }

  if (status === 'joined') {
    return (
      <p data-testid="waitlist_joined" role="status" className="mt-4 text-body-md text-text">
        Casi está. Te hemos enviado un correo: confirma desde ahí tu dirección y te avisaremos del lanzamiento.
      </p>
    );
  }

  return (
    <form
      onSubmit={event => void handleSubmit(event)}
      onFocusCapture={() => setTouched(true)}
      onChangeCapture={() => setTouched(true)}
      className="mx-auto mt-10 flex max-w-sm flex-col gap-3 text-left"
    >
      <p className="text-center text-body-md text-tertiary">¿Prefieres que te avisemos del lanzamiento?</p>
      <EmailInput data-testid="waitlist_email_input" value={email} onChange={setEmail} disabled={status === 'sending'} />
      <label className="flex cursor-pointer items-start gap-2 text-body-sm text-tertiary">
        <span className="flex size-6 shrink-0 items-center justify-center">
          <Checkbox
            data-testid="waitlist_consent_checkbox"
            checked={consent}
            onChange={event => setConsent(event.target.checked)}
            className="rounded-sm"
          />
        </span>
        <span>
          {WAITLIST_CONSENT_TEXT}
          {' '}
          <a href="/legal/privacidad" target="_blank" rel="noreferrer" className="underline">Política de privacidad</a>
        </span>
      </label>
      <CaptchaField captcha={captcha} />
      {status === 'error' && (
        <p data-testid="waitlist_error" role="alert" className="text-body-sm text-error">
          No hemos podido apuntar tu correo. Inténtalo de nuevo.
        </p>
      )}
      <Button type="submit" variant="secondary" size="lg" disabled={!consent || email.trim().length === 0 || status === 'sending' || waitingForCaptcha} data-testid="waitlist_submit">
        Avisadme del lanzamiento
      </Button>
    </form>
  );
}
