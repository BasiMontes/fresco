/**
 * Household-size validation for onboarding step 3 (AC-3: "Laura introduce un
 * tamaño de hogar inválido"). Pure function, independently testable — see
 * STORY-FRESCO-5's implementation plan, Step 2.
 *
 * `num_personas` (the persisted household total) is derived as
 * `adultos + ninos` rather than asked as a third field, so the DB's
 * `check_adultos_personas` constraint (`adultos <= num_personas`) is
 * satisfied by construction once `ninos >= 0` — this function still asserts
 * it defensively in case the derivation changes later.
 */

export interface HouseholdInput {
  adultos: number
  ninos: number
}

export interface HouseholdValidationResult {
  valid: boolean
  message: string | null
}

export function validateHousehold({ adultos, ninos }: HouseholdInput): HouseholdValidationResult {
  if (adultos <= 0) {
    return { valid: false, message: 'Indica al menos un adulto en el hogar.' };
  }

  if (ninos < 0) {
    return { valid: false, message: 'El número de niños no puede ser negativo.' };
  }

  const numPersonas = adultos + ninos;

  if (adultos > numPersonas) {
    // Defensive: unreachable given adultos > 0 and ninos >= 0 above, kept in
    // case num_personas's derivation ever changes.
    return { valid: false, message: 'Los adultos no pueden superar el total de personas del hogar.' };
  }

  return { valid: true, message: null };
}
