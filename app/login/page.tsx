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
 * `/login` — sign-in counterpart to `/signup` for an existing account.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setLoginError(null);
    try {
      const client = createClient();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError(error.message);
        return;
      }
      router.push('/menu');
    }
    finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Image src="/brand/logo-base.svg" alt="Fresco" width={112} height={32} className="mx-auto mb-8" />

      <Card>
        <h1 className="text-h3">Inicia sesión</h1>
        <p className="mt-1 text-body-sm text-tertiary">
          Accede a tu cuenta para ver tu menú.
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
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <Button data-testid="login_submit_button" type="submit" className="mt-2" disabled={isSubmitting}>
            {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </Button>
        </form>

        {loginError && (
          <p data-testid="login_error_message" className="mt-4 text-body-sm text-error">
            {loginError}
          </p>
        )}

        <p className="mt-4 text-center text-body-sm text-tertiary">
          ¿No tienes cuenta?
          {' '}
          <Link href="/signup" className="text-primary">
            Crea una
          </Link>
        </p>
      </Card>
    </div>
  );
}
