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
