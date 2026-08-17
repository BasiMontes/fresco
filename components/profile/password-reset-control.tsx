'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export interface PasswordResetControlProps {
  /** Real logged-in email — same fallback caller uses elsewhere for consistency. */
  email: string
  className?: string
  /**
   * FRESCO-218 — this control now renders in two places on `/profile` at
   * once (the always-visible Cuenta card row, and `AyudaSection`'s
   * Configuración modal when opened) — a shared hardcoded testid would
   * collide under Playwright's strict `getByTestId` mode.
   */
  testId?: string
}

/**
 * FRESCO-161's "send a password reset link" flow, extracted out of
 * `AyudaSection`'s Configuración modal (FRESCO-218 needs the same control on
 * `/profile`'s Cuenta card) — one shared implementation instead of two
 * copies of the same `resetPasswordForEmail` call + anti-enumeration
 * posture (FRESCO-167: a real API failure surfaces, "unknown email" stays
 * silent, same as `app/forgot-password/page.tsx`).
 */
export function PasswordResetControl({ email, className, testId = 'cambiar_contrasena_button' }: PasswordResetControlProps) {
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function handleSend() {
    setIsSending(true);
    setError(false);
    try {
      const client = createClient();
      const { error: resetError } = await client.auth.resetPasswordForEmail(email);
      if (resetError) {
        setError(true);
        return;
      }
      setSent(true);
    }
    finally {
      setIsSending(false);
    }
  }

  if (sent) {
    return (
      <p data-testid={`${testId}_sent_message`} role="status" aria-live="polite" className={cn('text-tertiary', className)}>
        Te enviamos un enlace a
        {' '}
        {email}
        {' '}
        para elegir una nueva contraseña.
      </p>
    );
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-testid={testId}
        disabled={isSending}
        onClick={() => void handleSend()}
      >
        {isSending ? 'Enviando…' : 'Cambiar contraseña'}
      </Button>
      {error && (
        <p data-testid={`${testId}_error_message`} role="alert" aria-live="assertive" className="mt-2 text-body-sm text-error">
          No pudimos enviar el enlace. Inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}
