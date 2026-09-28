import type { NivelExperienciaCulinaria, ObjetivoUsuario, SexoUsuario, TipoCocina } from '@schemas';
import type { DietaFlag } from '@/lib/store/onboarding-store';
import { DIETA_IMPLIED_ALERGENOS } from '@/lib/constants/dietary-options';

/**
 * Static option lists + shared helpers for `/onboarding`'s 3-step wizard.
 * Extracted from `app/onboarding/page.tsx` (A5-M1, god-component split) —
 * pure data/functions, no behavior change from the original inline values.
 */

export const SEXO_OPTIONS: { value: SexoUsuario, label: string }[] = [
  { value: 'mujer', label: 'Mujer' },
  { value: 'hombre', label: 'Hombre' },
  { value: 'otro', label: 'Otro' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decirlo' },
];

export const OBJETIVO_OPTIONS: { value: ObjetivoUsuario, label: string }[] = [
  { value: 'perder_peso', label: 'Perder peso' },
  { value: 'comer_sano', label: 'Comer sano' },
  { value: 'ahorrar_dinero', label: 'Ahorrar dinero' },
  { value: 'ganar_masa_muscular', label: 'Ganar masa muscular' },
  { value: 'comer_variado', label: 'Comer más variado' },
  { value: 'reducir_desperdicio', label: 'Reducir desperdicio de comida' },
];

export const NIVEL_EXPERIENCIA_OPTIONS: { value: NivelExperienciaCulinaria, label: string }[] = [
  { value: 'aprendiz', label: 'Aprendiz' },
  { value: 'novato', label: 'Novato' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'chef', label: 'Chef' },
  { value: 'experto', label: 'Experto' },
];

export const DIETA_OPTIONS: { value: DietaFlag, label: string }[] = [
  { value: 'dietaVegetariano', label: 'Vegetariano' },
  { value: 'dietaVegano', label: 'Vegano' },
  { value: 'dietaSinGluten', label: 'Sin gluten' },
  { value: 'dietaSinLactosa', label: 'Sin lactosa' },
  { value: 'dietaSinHuevo', label: 'Sin huevo' },
  { value: 'dietaKeto', label: 'Keto' },
  { value: 'dietaHalal', label: 'Halal' },
];

export const COCINA_OPTIONS: { value: TipoCocina, label: string }[] = [
  { value: 'española', label: 'Española' },
  { value: 'italiana', label: 'Italiana' },
  { value: 'mexicana', label: 'Mexicana' },
  { value: 'asiática', label: 'Asiática' },
  { value: 'mediterránea', label: 'Mediterránea' },
  { value: 'latina', label: 'Latina' },
  { value: 'internacional', label: 'Internacional' },
];

// FRESCO-451 (slice 4/5, densidad y restraint): step 2 packs ~25 chips
// across 4 groups (dieta, alérgenos, ingredientes, cocinas) — the shared
// `outline` Tag variant borders every one of them in full brand-primary
// green regardless of selection, so the whole step reads as a wall of
// green with no contrast between "chosen" and "not chosen". Toning the
// unselected state down to a neutral hairline (scoped to this page only,
// not the shared Tag component — other `outline` callers are static
// badges, not this chip-wall) lets `selected`'s primary fill actually pop.
export const UNSELECTED_CHIP_CLASS = 'border-border text-tertiary';

export const ALERGENO_LABELS: Record<string, string> = {
  vegano: 'vegano',
  vegetariano: 'vegetariano',
  sinGluten: 'tu dieta sin gluten',
};

/**
 * FRESCO-275 — one message per locked alergeno, naming every active dieta
 * flag that implies it (a chip can be implied by more than one, e.g.
 * "pescado" by both vegano and vegetariano at once).
 */
export function alergenoLockMessage(value: string, flags: { vegano: boolean, vegetariano: boolean, sinGluten: boolean }): string {
  const reasons = (Object.keys(flags) as (keyof typeof flags)[])
    .filter(flag => flags[flag] && DIETA_IMPLIED_ALERGENOS[flag].includes(value))
    .map(flag => ALERGENO_LABELS[flag]);
  return `Ya excluido por ${reasons.join(' y ')} — ninguna receta de nuestro catálogo con esa etiqueta lo incluye.`;
}
