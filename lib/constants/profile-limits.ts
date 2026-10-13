// FRESCO-914: the size limits `user_profiles` enforces with CHECK constraints (migration
// `20261013170000_user_profiles_size_bounds.sql`). The inputs carry them as `maxLength` so a person
// never reaches the database error. Keep these equal to the constraints.

export const NOMBRE_MAX_LENGTH = 80;
export const TEXTO_LIBRE_MAX_LENGTH = 500;
export const PROFILE_LIST_MAX_ITEMS = 30;
