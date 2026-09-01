/**
 * Single source of truth for the password-length gate, shared by every
 * client form that sets or changes a password (`/signup`, onboarding
 * identity step, `/update-password`) and the `weak_password` error copy in
 * `lib/auth-errors.ts`.
 *
 * FRESCO-363 (audit-4 A4-H8): raised from 6 to 10 and enforced server-side
 * too — `supabase/config.toml` `minimum_password_length` and the hosted
 * project's `password_min_length` both match this value. Keep the three in
 * sync when changing it.
 */
export const MIN_PASSWORD_LENGTH = 10;

export const PASSWORD_TOO_SHORT_MESSAGE
  = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;

/** True when `password` is below the minimum length (client-side pre-check). */
export function isPasswordTooShort(password: string): boolean {
  return password.length < MIN_PASSWORD_LENGTH;
}
