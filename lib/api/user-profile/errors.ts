import { NOMBRE_MAX_LENGTH, PROFILE_LIST_MAX_ITEMS, TEXTO_LIBRE_MAX_LENGTH } from '@/lib/constants/profile-limits';

export class UserProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserProfileError';
  }
}

/** PostgreSQL `check_violation`: a row broke a CHECK constraint (FRESCO-914 caps the size of a profile). */
const CHECK_VIOLATION = '23514';

export function isCheckViolation(error: { code?: string | undefined }): boolean {
  return error.code === CHECK_VIOLATION;
}

/** Shown when a profile save is refused for size: the limits are in `user_profiles_*_bounds`. */
export const PROFILE_TOO_LARGE_MESSAGE
  = `Algún dato del perfil es demasiado largo: hasta ${PROFILE_LIST_MAX_ITEMS} elementos por lista, ${NOMBRE_MAX_LENGTH} caracteres en el nombre y ${TEXTO_LIBRE_MAX_LENGTH} en los textos libres.`;

export const NOMBRE_TOO_LONG_MESSAGE = `El nombre es demasiado largo: usa ${NOMBRE_MAX_LENGTH} caracteres como máximo.`;
