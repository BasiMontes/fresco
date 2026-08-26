export interface TagOption {
  value: string
  label: string
}

// Sourced from the seeded `recipes.alergenos` vocabulary (spot-checked
// directly against the DB, per STORY-FRESCO-5's implementation plan Risk 1
// mitigation) so a declared allergen actually matches what
// `get_filtered_recipes` filters on — not invented labels that would
// silently fail to protect Laura. Single source of truth for both the
// onboarding UI (label + value) and `upsertUserProfile`'s allow-list
// validation (value only) — a value entering `user_profiles.alergenos` that
// isn't in this list would silently fail to filter anything (see
// STORY-FRESCO-5's Technical Decision 1).
export const ALERGENO_OPTIONS: TagOption[] = [
  { value: 'gluten', label: 'Gluten' },
  { value: 'huevo', label: 'Huevo' },
  { value: 'pescado', label: 'Pescado' },
  { value: 'frutos_de_cascara', label: 'Frutos de cáscara' },
  { value: 'apio', label: 'Apio' },
  { value: 'sulfitos', label: 'Sulfitos' },
];

// Curated subset of the seeded `recipes.ingredientes_que_puede_desagradar`
// vocabulary — same rationale as allergens above.
export const INGREDIENTE_ODIADO_OPTIONS: TagOption[] = [
  { value: 'cebolla', label: 'Cebolla' },
  { value: 'champiñones', label: 'Champiñones' },
  { value: 'setas', label: 'Setas' },
  { value: 'cilantro', label: 'Cilantro' },
  { value: 'apio', label: 'Apio' },
  { value: 'comino', label: 'Comino' },
  { value: 'guisantes', label: 'Guisantes' },
  { value: 'judias verdes', label: 'Judías verdes' },
  { value: 'pimiento rojo', label: 'Pimiento rojo' },
  { value: 'pimiento verde', label: 'Pimiento verde' },
  { value: 'chorizo', label: 'Chorizo' },
  { value: 'panceta', label: 'Panceta' },
  { value: 'tocino', label: 'Tocino' },
  { value: 'morcilla', label: 'Morcilla' },
];

export const ALERGENO_VALUES = new Set(ALERGENO_OPTIONS.map(option => option.value));
export const INGREDIENTE_ODIADO_VALUES = new Set(INGREDIENTE_ODIADO_OPTIONS.map(option => option.value));

export interface DietaFlagsForLocks {
  vegano: boolean
  vegetariano: boolean
  sinGluten: boolean
}

/**
 * FRESCO-275 — data-derived, not assumed: queried live against the recipes
 * catalog (grouping every dieta flag x alergeno pair, counting recipes where
 * the flag is true AND that alergeno is present) and kept only the pairs
 * with zero co-occurrence. `vegetariano` deliberately excludes `huevo` —
 * 118/625 vegetarian-tagged recipes DO list egg as an allergen, so real data
 * contradicts the generic "vegetarians might not eat egg" assumption.
 */
export const DIETA_IMPLIED_ALERGENOS: Record<keyof DietaFlagsForLocks, string[]> = {
  sinGluten: ['gluten'],
  vegano: ['huevo', 'pescado', 'sulfitos'],
  vegetariano: ['pescado', 'sulfitos'],
};

/** Union of every alergeno implied by the currently-active dieta flags — drives which chips render locked/pre-selected. */
export function impliedAlergenos(flags: DietaFlagsForLocks): string[] {
  const implied = new Set<string>();
  if (flags.sinGluten) { DIETA_IMPLIED_ALERGENOS.sinGluten.forEach(value => implied.add(value)); }
  if (flags.vegetariano) { DIETA_IMPLIED_ALERGENOS.vegetariano.forEach(value => implied.add(value)); }
  if (flags.vegano) { DIETA_IMPLIED_ALERGENOS.vegano.forEach(value => implied.add(value)); }
  return [...implied];
}
