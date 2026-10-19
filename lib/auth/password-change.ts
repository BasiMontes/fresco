/**
 * FRESCO-1015 (audit 7b A7-AUTHZ-04): who must prove the current password before choosing a new one.
 *
 * A session built from an email link already proves control of the inbox: recovery (the
 * "forgot my password" link), a one-time code, a magic link, an email change, an invite, and a
 * guest that is being converted into an account (it has no password yet). A session built from
 * a password sign-in (or whose origin cannot be read) does not, so a stolen or left-open
 * session could otherwise lock the owner out. The app only asks; the Auth server enforces it
 * once "Require current password" is on in the project's Auth settings.
 */
const PROVEN_BY_LINK = new Set(['recovery', 'otp', 'magiclink', 'email_change', 'invite', 'anonymous']);

/** `methods` are the `amr` entries of the access token; `null` when they could not be read. */
export function needsCurrentPassword(methods: readonly string[] | null): boolean {
  if (methods === null) { return true; }
  return !methods.some(method => PROVEN_BY_LINK.has(method));
}

export const CURRENT_PASSWORD_REQUIRED_MESSAGE = 'Escribe tu contraseña actual.';
const CURRENT_PASSWORD_WRONG_MESSAGE = 'La contraseña actual no es correcta.';
const REAUTHENTICATION_NEEDED_MESSAGE = 'Por seguridad, vuelve a iniciar sesión antes de cambiar la contraseña.';

/** Spanish copy for the errors Auth returns on a password change; `null` for any other error. */
export function passwordChangeErrorMessage(error: { code?: string, message?: string }): string | null {
  if (error.code === 'reauthentication_needed' || error.code === 'reauthentication_not_valid') {
    return REAUTHENTICATION_NEEDED_MESSAGE;
  }
  if (error.code === 'current_password_mismatch' || /current password/i.test(error.message ?? '')) {
    return CURRENT_PASSWORD_WRONG_MESSAGE;
  }
  return null;
}
