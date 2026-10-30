import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { DIETA_FIELDS } from '@/lib/constants/dietary-options';

const MAX_DIETS_SHOWN = 2;

/**
 * FRESCO-1070 — the one-line summary under the "Preferencias" row of `/profile`: which diets are on
 * and how many allergens are filtered. It reads the saved profile, never local form state, so what it
 * says is what the recipe filter uses. "Sin dieta ni alérgenos guardados" says "saved", not
 * "none": an unreadable profile falls back to an empty one (`loadProfilePageData`), and the
 * sentence must not claim the user has no restrictions.
 */
export function summarizePreferences(preferences: OnboardingProfilePayload): string {
  const diets = DIETA_FIELDS.filter(({ key }) => preferences[key]).map(({ label }) => label);
  const allergenCount = preferences.alergenos.length;
  const parts: string[] = [];

  if (diets.length > 0) {
    const shown = diets.slice(0, MAX_DIETS_SHOWN).join(', ');
    parts.push(diets.length > MAX_DIETS_SHOWN ? `${shown} +${diets.length - MAX_DIETS_SHOWN}` : shown);
  }
  if (allergenCount > 0) {
    parts.push(allergenCount === 1 ? '1 alérgeno' : `${allergenCount} alérgenos`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Sin dieta ni alérgenos guardados';
}
