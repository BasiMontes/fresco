/**
 * Password-strength scoring for the onboarding "create account" branch
 * (FRESCO-198). Pure function, independently testable — no dependency on
 * Supabase's own `weak_password` threshold (`lib/auth-errors.ts`, min 6
 * chars): this is a UX signal shown live as she types, not a hard gate —
 * the actual submit-time gate stays whatever Supabase enforces server-side.
 *
 * Scoring is intentionally simple (length + character-class variety), not a
 * dictionary/entropy library (no such dependency exists in this repo) —
 * good enough to nudge behavior without adding a new dependency for a
 * cosmetic indicator.
 */

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) {
    return 'weak';
  }

  let score = 0;
  if (password.length >= 8) { score += 1; }
  if (password.length >= 12) { score += 1; }
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) { score += 1; }
  if (/\d/.test(password)) { score += 1; }
  if (/[^A-Z0-9]/i.test(password)) { score += 1; }

  if (score <= 1) {
    return 'weak';
  }
  if (score <= 3) {
    return 'medium';
  }
  return 'strong';
}

export const PASSWORD_STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: 'Floja',
  medium: 'Media',
  strong: 'Fuerte',
};
