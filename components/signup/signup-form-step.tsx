import type { useCaptcha } from '@/components/auth/use-captcha';
import type { useSignupSubmit } from '@/components/signup/use-signup-submit';
import Link from 'next/link';
import { CaptchaField } from '@/components/auth/captcha-field';
import { ConsentCheckboxes } from '@/components/legal/consent-checkboxes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';

interface SignupFormStepProps {
  email: string
  password: string
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  submit: ReturnType<typeof useSignupSubmit>
  captcha: ReturnType<typeof useCaptcha>
}

export function SignupFormStep({ email, password, onEmailChange, onPasswordChange, submit, captcha }: SignupFormStepProps) {
  const { isSubmitting, signupError, ageConfirmed, setAgeConfirmed, ageError, acceptedTerms, setAcceptedTerms, termsError, handleSubmit } = submit;

  return (
    <>
      <h1 className="text-h3">Guarda tu menú</h1>
      <p className="mt-1 text-body-sm text-tertiary">
        Crea una cuenta para no perder el menú que acabamos de generar.
      </p>

      <form onSubmit={event => void handleSubmit(event)} className="mt-6 flex flex-col gap-3">
        {/* FRESCO-315: real <label for> instead of an aria-label
            that only duplicated the placeholder (WCAG 3.3.2 /
            4.1.2). sr-only keeps the card design unchanged. */}
        <label htmlFor="signup-email" className="sr-only">Correo electrónico</label>
        <Input
          id="signup-email"
          data-testid="email_input"
          type="email"
          placeholder="Correo electrónico"
          required
          autoComplete="email"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
        />
        {/* FRESCO-448 (S9): was a bare <Input> — the highest-
            traffic signup path had the weakest password field
            (no show/hide, no strength meter, no policy hint,
            and a native minLength bubble). Now matches the
            onboarding "Crear cuenta" field. */}
        <PasswordInput
          value={password}
          onChange={onPasswordChange}
          data-testid="password_input"
          autoComplete="new-password"
          showPolicyHint
        />
        <ConsentCheckboxes
          ageConfirmed={ageConfirmed}
          termsAccepted={acceptedTerms}
          onAgeChange={setAgeConfirmed}
          onTermsChange={setAcceptedTerms}
          ageError={ageError}
          termsError={termsError}
        />

        <CaptchaField captcha={captcha} />
        <Button data-testid="signup_submit_button" type="submit" className="mt-2" disabled={isSubmitting || !captcha.ready}>
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>

      {signupError && (
        <p data-testid="signup_error_message" role="alert" aria-live="assertive" className="mt-4 text-body-sm text-error">
          {signupError}
        </p>
      )}

      <p className="mt-4 text-center text-body-sm text-tertiary">
        ¿Ya tienes cuenta?
        {' '}
        {/* FRESCO-499: underline distinguishes this inline link from
            the surrounding text without relying on color alone
            (axe link-in-text-block), matching the underline already
            used for the Términos/Privacidad in-text links. */}
        <Link href="/login" className="text-primary underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
