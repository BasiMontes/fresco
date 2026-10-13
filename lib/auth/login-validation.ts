// FRESCO-944: what `/login` tells the person when a submit cannot go ahead. The button used
// to be disabled without a word (an unsolved captcha, an empty field); now it stays
// available and each missing piece is named in line.

export interface LoginFieldErrors {
  email: string | null
  password: string | null
  captcha: string | null
}

export const NO_LOGIN_FIELD_ERRORS: LoginFieldErrors = { email: null, password: null, captcha: null };

const EMAIL_SHAPE = /^\S[^\s@]*@\S[^\s.]*\.\S+$/;

export function validateLoginFields({ email, password, captchaReady }: { email: string, password: string, captchaReady: boolean }): LoginFieldErrors {
  const trimmedEmail = email.trim();
  let emailError: string | null = null;
  if (trimmedEmail === '') {
    emailError = 'Introduce tu correo electrónico.';
  }
  else if (!EMAIL_SHAPE.test(trimmedEmail)) {
    emailError = 'Introduce un correo válido.';
  }
  return {
    email: emailError,
    password: password === '' ? 'Introduce tu contraseña.' : null,
    captcha: captchaReady ? null : 'Espera a que termine la verificación de arriba para continuar.',
  };
}

export function hasLoginFieldErrors(errors: LoginFieldErrors): boolean {
  return errors.email !== null || errors.password !== null || errors.captcha !== null;
}
