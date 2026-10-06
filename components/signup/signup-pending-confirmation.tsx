import Link from 'next/link';

/**
 * FRESCO-190: this project requires email confirmation, so `signUp()`
 * succeeds without establishing a session. She sees a clear "check your
 * email" state instead of being redirected to /onboarding, where
 * `ensureGuestSession()` would otherwise find no session and silently create
 * a disconnected anonymous guest.
 */
export function SignupPendingConfirmation({ email }: { email: string }) {
  return (
    <>
      <h1 className="text-h3">Revisa tu correo</h1>
      <p data-testid="signup_confirmation_pending_message" role="status" aria-live="polite" className="mt-1 text-body-sm text-tertiary">
        Te enviamos un enlace de confirmación a
        {' '}
        <strong>{email}</strong>
        . Ábrelo para activar tu cuenta y luego inicia sesión.
      </p>
      <p className="mt-4 text-center text-body-sm text-tertiary">
        <Link href="/login" className="text-primary">
          Ir a iniciar sesión
        </Link>
      </p>
    </>
  );
}
