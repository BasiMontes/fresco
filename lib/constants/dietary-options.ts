export interface TagOption {
  value: string
  label: string
}

// The full canonical `recipes.alergenos` vocabulary (verified live against
// the catalog — FRESCO-361 / A4-B2, and now pinned by a CHECK constraint on
// `recipes.alergenos`). Single source of truth for both the onboarding UI
// (label + value) and `upsertUserProfile`'s allow-list validation (value
// only) — a value entering `user_profiles.alergenos` that isn't in this list
// would silently fail to filter anything.
//
// Before FRESCO-361 this list held only 6 of the catalog's tags, so a user
// allergic to e.g. peanuts or soy literally could not declare it and got
// served those recipes. `frutos_secos` was merged into `frutos_de_cascara`
// in that same migration. Known gap: `mostaza` and `altramuces` (2 of the
// EU-14) are not in the catalog — no source data to re-tag 1000 recipes;
// tracked separately.
export const ALERGENO_OPTIONS: TagOption[] = [
  { value: 'gluten', label: 'Gluten' },
  { value: 'lactosa', label: 'Lactosa' },
  { value: 'huevo', label: 'Huevo' },
  { value: 'frutos_de_cascara', label: 'Frutos de cáscara' },
  { value: 'cacahuetes', label: 'Cacahuetes' },
  { value: 'soja', label: 'Soja' },
  { value: 'pescado', label: 'Pescado' },
  { value: 'crustaceos', label: 'Crustáceos' },
  { value: 'moluscos', label: 'Moluscos' },
  { value: 'sesamo', label: 'Sésamo' },
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
