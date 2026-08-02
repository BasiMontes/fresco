'use client';

import type { FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

/**
 * `/forgot-password` — FRESCO-52 step 1: request a recovery link.
 * Wrapped in `Suspense` (Next 16: a static page calling `useSearchParams`
 * from a Client Component needs one, or the production build fails —
 * same reason `/login` is wrapped).
 */
export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordPageInner />
    </Suspense>
  );
}

function ForgotPasswordPageInner() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // FRESCO-52: `/auth/confirm` redirects back here with this flag when the
  // recovery link was invalid/expired, so the user can immediately request
  // a new one instead of hitting a dead end.
  const invalidLink = useSearchParams().get('error') === 'invalid_link';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const client = createClient();
      // Anti-enumeration (same posture as signup, ADR-0004-adjacent): the
      // request always resolves the same way client-side regardless of
      // whether `email` has an account — Supabase's own API already never
      // reveals this either way, so no branching is needed here at all.
      await client.auth.resetPasswordForEmail(email);
      setSubmitted(true);
    }
    finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Image src="/brand/logo-base.svg" alt="Fresco" width={112} height={34} className="mx-auto mb-8" priority />

      <Card>
        <h1 className="text-h3">Recupera tu contraseña</h1>
        <p className="mt-1 text-body-sm text-tertiary">
          Te enviamos un enlace para elegir una nueva contraseña.
        </p>

        {invalidLink && (
          <p data-testid="invalid_link_message" role="alert" aria-live="assertive" className="mt-4 text-body-sm text-error">
            Ese enlace ya no es válido. Solicita uno nuevo abajo.
          </p>
        )}

        {submitted
          ? (
              <p data-testid="forgot_password_confirmation_message" role="status" aria-live="polite" className="mt-6 text-body-sm text-text">
                Si existe una cuenta con ese email, te llegará un enlace para restablecer tu contraseña en unos minutos.
              </p>
            )
          : (
              <form onSubmit={event => void handleSubmit(event)} className="mt-6 flex flex-col gap-3">
                <Input
                  data-testid="forgot_password_email_input"
                  type="email"
                  placeholder="Correo electrónico"
                  aria-label="Correo electrónico"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                <Button data-testid="forgot_password_submit_button" type="submit" className="mt-2" disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
                </Button>
              </form>
            )}

        <p className="mt-4 text-center text-body-sm text-tertiary">
          <Link href="/login" className="text-primary">
            Volver a iniciar sesión
          </Link>
        </p>
      </Card>
    </div>
  );
}
