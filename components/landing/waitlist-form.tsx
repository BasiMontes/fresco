'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmailInput } from '@/components/ui/email-input';
import { joinWaitlist } from '@/lib/client-api/waitlist';
import { WAITLIST_CONSENT_TEXT } from '@/lib/legal/waitlist-text';

type Status = 'idle' | 'sending' | 'joined' | 'error';

/**
 * FRESCO-888 — early-interest form under the final CTA: one email and one
 * explicit, unticked consent. The consent is recorded server-side with the
 * version of the text (`POST /api/waitlist`). FRESCO-1008: that only registers a PENDING signup; the address is added once its owner confirms from the email we send. The submit stays disabled until the
 * box is ticked, so a visitor cannot join without having consented.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setStatus((await joinWaitlist(email.trim())) ? 'joined' : 'error');
  }

  if (status === 'joined') {
    return (
      <p data-testid="waitlist_joined" role="status" className="mt-4 text-body-md text-text">
        Casi está. Te hemos enviado un correo: confirma desde ahí tu dirección y te avisaremos del lanzamiento.
      </p>
    );
  }

  return (
    <form onSubmit={event => void handleSubmit(event)} className="mx-auto mt-10 flex max-w-sm flex-col gap-3 text-left">
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
      {status === 'error' && (
        <p data-testid="waitlist_error" role="alert" className="text-body-sm text-error">
          No hemos podido apuntar tu correo. Inténtalo de nuevo.
        </p>
      )}
      <Button type="submit" variant="secondary" size="lg" disabled={!consent || email.trim().length === 0 || status === 'sending'} data-testid="waitlist_submit">
        Avisadme del lanzamiento
      </Button>
    </form>
  );
}
