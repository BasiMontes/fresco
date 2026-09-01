import { isAuthError } from '@supabase/supabase-js';
import { MIN_PASSWORD_LENGTH } from '@/lib/validation/password-policy';

/**
 * FRESCO-106 — Supabase Auth errors were shown raw in English
 * (`error.message`) in an otherwise fully-Spanish app. Keyed by
 * `error.code`, not `error.message`: the project already relies on
 * `error.code === 'email_exists'` elsewhere (`app/signup/page.tsx`), and
 * codes are the documented, stable identifier — message text is not.
 *
 * `isAuthError` (the base-class guard), not `isAuthApiError`: a weak
 * password comes back as `AuthWeakPasswordError`, a `CustomAuthError`
 * subclass — `isAuthApiError` returns false for it even though it still
 * carries the same `code`/`weak_password`. Confirmed live: the real
 * Supabase response body for a 3-char password is
 * `{"code":"weak_password","message":"Password should be at least 6
 * characters."}` — `isAuthApiError` was silently swallowing the mapped
 * case into the generic fallback.
 *
 * FRESCO-363 (A4-H8): `weak_password` now also fires for a breached password
 * (server-side leaked-password protection), not only a short one, so the
 * mapped copy covers both reasons. The client forms pre-check length and
 * HIBP before submit, so this is a fallback.
 *
 * Unmapped Auth errors, and non-Auth errors entirely (network failures,
 * CORS, rate-limiting — none of which carry an `error.code`), fall
 * through to one generic Spanish message rather than leaking the
 * original text.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  weak_password: `La contraseña es demasiado débil: usa al menos ${MIN_PASSWORD_LENGTH} caracteres y evita contraseñas comunes o filtradas.`,
  user_already_exists: 'Ya existe una cuenta con ese email.',
  email_exists: 'Ya existe una cuenta con ese email.',
  email_not_confirmed: 'Confirma tu email antes de iniciar sesión.',
  over_request_rate_limit: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
  over_email_send_rate_limit: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
  same_password: 'La nueva contraseña debe ser distinta a la actual.',
  otp_expired: 'El código expiró o no es válido. Solicita uno nuevo.',
};

const GENERIC_AUTH_ERROR = 'Algo salió mal. Inténtalo de nuevo en unos segundos.';

export function translateAuthError(error: unknown): string {
  if (isAuthError(error) && error.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code];
  }
  return GENERIC_AUTH_ERROR;
}
