import type { useSignupOtp } from '@/components/signup/use-signup-otp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SignupOtpStepProps {
  email: string
  otp: ReturnType<typeof useSignupOtp>
}

export function SignupOtpStep({ email, otp }: SignupOtpStepProps) {
  const { otpCode, setOtpCode, otpError, isVerifyingOtp, isResendingOtp, resendMessage, handleVerifyOtp, handleResendOtp } = otp;

  return (
    <>
      <h1 className="text-h3">Revisa tu correo</h1>
      <p className="mt-1 text-body-sm text-tertiary">
        Te enviamos un código a
        {' '}
        <strong>{email}</strong>
        . Ingrésalo para confirmar tu cuenta.
      </p>

      <form onSubmit={event => void handleVerifyOtp(event)} className="mt-6 flex flex-col gap-3">
        <Input
          data-testid="otp_code_input"
          type="text"
          inputMode="numeric"
          placeholder="Código de 6 dígitos"
          aria-label="Código de verificación"
          required
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          value={otpCode}
          onChange={e => setOtpCode(e.target.value)}
        />

        {otpError && (
          <p data-testid="signup_otp_error_message" role="alert" aria-live="assertive" className="text-body-sm text-error">
            {otpError}
          </p>
        )}

        {resendMessage && (
          <p data-testid="signup_otp_resend_message" role="status" aria-live="polite" className="text-body-sm text-tertiary">
            {resendMessage}
          </p>
        )}

        <Button data-testid="signup_verify_otp_button" type="submit" className="mt-2" disabled={isVerifyingOtp || otpCode.length !== 6}>
          {isVerifyingOtp ? 'Verificando…' : 'Confirmar código'}
        </Button>

        <button
          type="button"
          data-testid="signup_resend_otp_button"
          onClick={() => void handleResendOtp()}
          disabled={isResendingOtp}
          className="text-center text-body-sm text-primary underline"
        >
          {isResendingOtp ? 'Reenviando…' : '¿No te llegó? Reenviar código'}
        </button>
      </form>
    </>
  );
}
