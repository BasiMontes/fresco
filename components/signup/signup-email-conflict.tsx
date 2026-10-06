import type { useCaptcha } from '@/lib/auth/use-captcha';
import type { useSignupReassign } from '@/lib/signup/use-signup-reassign';
import Link from 'next/link';
import { CaptchaField } from '@/components/auth/captcha-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SignupEmailConflictProps {
  reassign: ReturnType<typeof useSignupReassign>
  captcha: ReturnType<typeof useCaptcha>
}

export function SignupEmailConflict({ reassign, captcha }: SignupEmailConflictProps) {
  const { conflictPassword, setConflictPassword, isReassigning, reassignError, handleReassign } = reassign;

  return (
    <>
      <h1 className="text-h3">Ya existe una cuenta con ese email</h1>
      <p data-testid="signup_email_conflict_message" role="alert" aria-live="assertive" className="mt-1 text-body-sm text-tertiary">
        Ingresa su contraseña para continuar con ella y conservar el menú que acabas de generar.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleReassign();
        }}
        className="mt-6 flex flex-col gap-3"
      >
        <label htmlFor="conflict-password" className="sr-only">Contraseña de esa cuenta</label>
        <Input
          id="conflict-password"
          data-testid="conflict_password_input"
          type="password"
          placeholder="Contraseña de esa cuenta"
          autoComplete="current-password"
          value={conflictPassword}
          onChange={e => setConflictPassword(e.target.value)}
        />
        <CaptchaField captcha={captcha} />
        <Button
          data-testid="signup_reassign_button"
          type="submit"
          variant="secondary"
          disabled={isReassigning || !conflictPassword || !captcha.ready}
        >
          {isReassigning ? 'Verificando…' : 'Continuar con esta cuenta'}
        </Button>
      </form>
      {reassignError && (
        <p data-testid="signup_reassign_error_message" role="alert" aria-live="assertive" className="mt-3 text-body-sm text-error">
          {reassignError}
        </p>
      )}
      <p className="mt-4 text-center text-body-sm text-tertiary">
        o
        {' '}
        <Link href="/login" className="text-primary">
          inicia sesión manualmente
        </Link>
      </p>
    </>
  );
}
