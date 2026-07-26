import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/**
 * `/signup` — EPIC-FRESCO-7 (Progressive Signup, US 7.1): a guest is asked
 * to sign up only AFTER seeing a generated menu (user-journeys.md Journey 1,
 * Step 5 — "keep what you just saw", not a paywall). Page shell only: real
 * Supabase Auth wiring (`signUp()`) belongs to the backend agent's auth
 * setup + `/sprint-development` story work.
 */
export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Image src="/brand/logo-base.svg" alt="Fresco" width={112} height={32} className="mx-auto mb-8" />

      <Card>
        <h1 className="text-h3">Guarda tu menú</h1>
        <p className="mt-1 text-body-sm text-tertiary">
          Crea una cuenta para no perder el menú que acabamos de generar.
        </p>

        <form className="mt-6 flex flex-col gap-3">
          <Input type="email" placeholder="Correo electrónico" required autoComplete="email" />
          <Input type="password" placeholder="Contraseña" required autoComplete="new-password" />
          <Button type="submit" className="mt-2">
            Crear cuenta
          </Button>
        </form>

        <p className="mt-4 text-center text-body-sm text-tertiary">
          ¿Ya tienes cuenta?
          {' '}
          <Link href="/" className="text-primary">
            Inicia sesión
          </Link>
        </p>
      </Card>
    </div>
  );
}
