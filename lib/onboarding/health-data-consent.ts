/**
 * FRESCO-794 (ADR-0040) — when the onboarding wizard is collecting health data
 * (GDPR art. 9) and so needs the user's explicit consent before it goes on.
 *
 * Allergies are health data; so are the diet restrictions that imply one
 * (vegano and sin gluten imply allergens, halal and the rest can reveal beliefs)
 * and the free-text diet field, where a user can write anything. Disliked
 * ingredients and favourite cuisines are taste, not health, and do not count.
 */

export interface HealthDataFields {
  dietaVegetariano: boolean
  dietaVegano: boolean
  dietaSinGluten: boolean
  dietaSinLactosa: boolean
  dietaSinHuevo: boolean
  dietaKeto: boolean
  dietaHalal: boolean
  alergenos: string[]
  dietaTextoLibre: string
}

export function collectsHealthData(fields: HealthDataFields): boolean {
  return fields.alergenos.length > 0
    || fields.dietaTextoLibre.trim().length > 0
    || fields.dietaVegetariano
    || fields.dietaVegano
    || fields.dietaSinGluten
    || fields.dietaSinLactosa
    || fields.dietaSinHuevo
    || fields.dietaKeto
    || fields.dietaHalal;
}

/**
 * The wizard may go on when no health data is filled in, or when the user has
 * ticked the explicit consent. Used by `app/onboarding/page.tsx` to enable
 * "Siguiente", "Ver resumen" and "Empezar".
 */
export function isHealthConsentSatisfied(fields: HealthDataFields & { healthDataConsent: boolean }): boolean {
  return !collectsHealthData(fields) || fields.healthDataConsent;
}
