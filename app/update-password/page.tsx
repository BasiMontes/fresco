'use client';

import type { FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { createClient } from '@/lib/supabase/client';

/**
 * `/update-password` — FRESCO-52 step 2. Only reachable with a real
 * recovery session, established server-side by `app/auth/confirm/route.ts`
 * (`verifyOtp`) before the redirect that lands here — so this page never
 * verifies a token itself, it only checks a session already exists.
 *
 * On success, signs the user out and sends her to `/login` rather than
 * leaving her silently signed in on the recovery session — the AC's own
 * wording ("puede iniciar sesión con la nueva contraseña") is a real login
 * step, not an implicit continuation, and it's the safer default on a
 * shared/public device.
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // FRESCO-114: see login/page.tsx — a ref guard catches a synchronous
  // double-click that `disabled={isSubmitting}` alone misses.
  const isSubmittingRef = React.useRef(false);

  React.useEffect(() => {
    const client = createClient();
    void client.auth.getSession().then(({ data: { session } }) => {
      setHasSession(session !== null);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (isSubmittingRef.current) { return; }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const client = createClient();
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      await client.auth.signOut();
      // FRESCO-150: sessionStorage isn't scoped per-account — clear any
      // onboarding draft so it doesn't leak into whoever logs in next on
      // this browser tab.
      useOnboardingStore.getState().reset();
      router.push('/login?password_reset=1');
    }
    finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Image src="/brand/logo-base.svg" alt="Fresco" width={112} height={34} className="mx-auto mb-8" priority />

      <Card>
        <h1 className="text-h3">Elige una nueva contraseña</h1>

        {hasSession === null && (
          <p data-testid="update_password_loading" role="status" className="mt-4 text-body-sm text-tertiary">
            Comprobando tu enlace…
          </p>
        )}

        {hasSession === false && (
          <p data-testid="update_password_no_session_message" role="alert" aria-live="assertive" className="mt-4 text-body-sm text-error">
            Este enlace ya no es válido. Solicita uno nuevo desde
            {' '}
            <a href="/forgot-password" className="text-primary">recuperar contraseña</a>
            .
          </p>
        )}

        {hasSession === true && (
          <form onSubmit={event => void handleSubmit(event)} className="mt-6 flex flex-col gap-3">
            <Input
              data-testid="update_password_new_input"
              type="password"
              placeholder="Nueva contraseña"
              aria-label="Nueva contraseña"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
            />
            <Input
              data-testid="update_password_confirm_input"
              type="password"
              placeholder="Confirma la nueva contraseña"
              aria-label="Confirma la nueva contraseña"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
            />
            <Button data-testid="update_password_submit_button" type="submit" className="mt-2" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
          </form>
        )}

        {error && (
          <p data-testid="update_password_error_message" role="alert" aria-live="assertive" className="mt-4 text-body-sm text-error">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
