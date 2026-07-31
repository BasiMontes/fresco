'use client';

import type { FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSignupError(null);
    setEmailConflict(false);
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();

      // FRESCO-19 (Progressive Signup, US 7.1): a guest arrives here with an
      // active anonymous session (ADR-0003) — converting it via `updateUser`
      // preserves the same `user_id`, so the menu she already generated
      // stays hers. `signUp` would create an unrelated new user instead.
      if (user?.is_anonymous) {
        const { error } = await client.auth.updateUser({ email, password });
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
            setSignupError(error.message);
          }
          return;
        }
        // She already has a profile + generated menu — back to it, not onboarding.
        router.push('/menu');
        return;
      }

      const { error } = await client.auth.signUp({ email, password });
      if (error) {
        setSignupError(error.message);
        return;
      }
      // New users always go through onboarding next — see FRESCO-1.
      router.push('/onboarding');
    }
    finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Image src="/brand/logo-base.svg" alt="Fresco" width={112} height={32} className="mx-auto mb-8" />

      <Card>
        <h1 className="text-h3">Guarda tu menú</h1>
        <p className="mt-1 text-body-sm text-tertiary">
          Crea una cuenta para no perder el menú que acabamos de generar.
        </p>

        <form onSubmit={event => void handleSubmit(event)} className="mt-6 flex flex-col gap-3">
          <Input
            data-testid="email_input"
            type="email"
            placeholder="Correo electrónico"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Input
            data-testid="password_input"
            type="password"
            placeholder="Contraseña"
            required
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <Button data-testid="signup_submit_button" type="submit" className="mt-2" disabled={isSubmitting}>
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
        </form>

        {signupError && (
          <p data-testid="signup_error_message" className="mt-4 text-body-sm text-error">
            {signupError}
          </p>
        )}

        {emailConflict && (
          <p data-testid="signup_email_conflict_message" className="mt-4 text-body-sm text-error">
            Ya existe una cuenta con ese email.
            {' '}
            <Link href="/login" className="text-primary">
              Inicia sesión
            </Link>
            {' '}
            para continuar.
          </p>
        )}

        <p className="mt-4 text-center text-body-sm text-tertiary">
          ¿Ya tienes cuenta?
          {' '}
          <Link href="/login" className="text-primary">
            Inicia sesión
          </Link>
        </p>
      </Card>
    </div>
  );
}
