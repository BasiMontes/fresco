'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Status = 'idle' | 'sending' | 'done' | 'invalid' | 'error';

const COPY = {
  confirm: {
    intro: 'Pulsa el botón para confirmar tu correo y que te avisemos del lanzamiento de Fresco.',
    button: 'Confirmar mi correo',
    done: 'Listo, tu correo está confirmado. Te avisaremos del lanzamiento.',
  },
  remove: {
    intro: 'Pulsa el botón para que borremos tu correo de la lista de espera.',
    button: 'Borrar mi correo',
    done: 'Hecho. Hemos borrado tu correo de la lista de espera.',
  },
} as const;

/**
 * FRESCO-1008 — the button behind the links of the waitlist email: `POST /api/waitlist/confirm`
 * with the token from the link, to confirm the address or to remove it.
 */
export function WaitlistConfirm({ token, action }: { token: string, action: 'confirm' | 'remove' }) {
  const [status, setStatus] = useState<Status>('idle');
  const copy = COPY[action];

  async function submit() {
    setStatus('sending');
    try {
      const response = await fetch('/api/waitlist/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      });
      setStatus(response.ok ? 'done' : response.status === 404 ? 'invalid' : 'error');
    }
    catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return <p data-testid="waitlist_confirm_done" role="status">{copy.done}</p>;
  }
  if (status === 'invalid') {
    return <p data-testid="waitlist_confirm_invalid" role="alert">Este enlace ya no es válido: puede que tu correo ya se hubiera borrado de la lista.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p>{copy.intro}</p>
      {status === 'error' && <p data-testid="waitlist_confirm_error" role="alert" className="text-body-sm text-error">No hemos podido completarlo. Inténtalo de nuevo.</p>}
      <Button data-testid="waitlist_confirm_button" onClick={() => void submit()} disabled={status === 'sending'}>{copy.button}</Button>
    </div>
  );
}
