import type { TipoCocina } from '@schemas';
import { create } from 'zustand';

/**
 * Client-side state for the 3-step onboarding flow (EPIC-FRESCO-1: diet,
 * allergens, disliked ingredients, favorite cuisines, household size). A
 * single route (`/onboarding`) drives all 3 steps internally rather than 3
 * separate routes — judgment call, see report: keeps the guest's "3 steps
 * only" promise (user-journeys.md Journey 1, Step 2) legible as one
 * continuous flow instead of full-page navigations between steps.
 *
 * Field names mirror `user_profiles`' columns field-for-field (camelCase
 * here; mapped to the snake_case column names at the persistence boundary in
 * `lib/api/user-profile.ts`), per STORY-FRESCO-5's implementation plan Step 1.
 */

export type DietaFlag
  = | 'dietaVegetariano'
    | 'dietaVegano'
    | 'dietaSinGluten'
    | 'dietaSinLactosa'
    | 'dietaSinHuevo'
    | 'dietaKeto'
    | 'dietaHalal';

export interface OnboardingState {
  step: 1 | 2 | 3
  dietaVegetariano: boolean
  dietaVegano: boolean
  dietaSinGluten: boolean
  dietaSinLactosa: boolean
  dietaSinHuevo: boolean
  dietaKeto: boolean
  dietaHalal: boolean
  alergenos: string[]
  ingredientesOdiados: string[]
  cocinasFavoritas: TipoCocina[]
  adultos: number
  ninos: number
  setStep: (step: 1 | 2 | 3) => void
  toggleDieta: (field: DietaFlag) => void
  toggleAlergeno: (value: string) => void
  toggleIngredienteOdiado: (value: string) => void
  toggleCocina: (value: TipoCocina) => void
  setAdultos: (value: number) => void
  setNinos: (value: number) => void
  reset: () => void
}

const initialState = {
  step: 1 as const,
  dietaVegetariano: false,
  dietaVegano: false,
  dietaSinGluten: false,
  dietaSinLactosa: false,
  dietaSinHuevo: false,
  dietaKeto: false,
  dietaHalal: false,
  alergenos: [] as string[],
  ingredientesOdiados: [] as string[],
  cocinasFavoritas: [] as TipoCocina[],
  adultos: 2,
  ninos: 0,
};

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

export const useOnboardingStore = create<OnboardingState>(set => ({
  ...initialState,
  setStep: step => set({ step }),
  toggleDieta: field =>
    set((state) => {
      // AC-2: a "vegana" declaration always implies "vegetariana" — enforced
      // here (not just at submit time) so the invariant holds at every
      // intermediate render, mirroring the DB's check_vegano_es_vegetariano
      // constraint.
      if (field === 'dietaVegetariano' && state.dietaVegano) {
        // Blocked: untoggling vegetariano while vegano is still selected
        // would break the invariant — no-op instead of a partial state.
        return state;
      }
      if (field === 'dietaVegano') {
        const nextVegano = !state.dietaVegano;
        return {
          dietaVegano: nextVegano,
          dietaVegetariano: nextVegano ? true : state.dietaVegetariano,
        };
      }
      switch (field) {
        case 'dietaVegetariano':
          return { dietaVegetariano: !state.dietaVegetariano };
        case 'dietaSinGluten':
          return { dietaSinGluten: !state.dietaSinGluten };
        case 'dietaSinLactosa':
          return { dietaSinLactosa: !state.dietaSinLactosa };
        case 'dietaSinHuevo':
          return { dietaSinHuevo: !state.dietaSinHuevo };
        case 'dietaKeto':
          return { dietaKeto: !state.dietaKeto };
        case 'dietaHalal':
          return { dietaHalal: !state.dietaHalal };
        default:
          return state;
      }
    }),
  toggleAlergeno: value => set(state => ({ alergenos: toggleInArray(state.alergenos, value) })),
  toggleIngredienteOdiado: value =>
    set(state => ({ ingredientesOdiados: toggleInArray(state.ingredientesOdiados, value) })),
  toggleCocina: value =>
    set(state => ({ cocinasFavoritas: toggleInArray(state.cocinasFavoritas, value) })),
  setAdultos: value => set({ adultos: value }),
  setNinos: value => set({ ninos: value }),
  reset: () => set(initialState),
}));
