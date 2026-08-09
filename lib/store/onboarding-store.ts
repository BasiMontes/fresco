import type { DiaSemana, NivelExperienciaCulinaria, ObjetivoUsuario, SexoUsuario, TipoCocina, TipoPlatoSlot } from '@schemas';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Client-side state for the 4-step onboarding flow (EPIC-FRESCO-1: name,
 * sex, goal, diet, allergens, disliked ingredients, favorite cuisines,
 * household size — step 1, name/sex/goal, added by FRESCO-132). A single
 * route (`/onboarding`) drives all steps internally rather than separate
 * routes — judgment call, see report: keeps the flow legible as one
 * continuous journey instead of full-page navigations between steps.
 *
 * Field names mirror `user_profiles`' columns field-for-field (camelCase
 * here; mapped to the snake_case column names at the persistence boundary in
 * `lib/api/user-profile.ts`), per STORY-FRESCO-5's implementation plan Step 1.
 */

export const ALL_DIAS_SEMANA: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

export type DietaFlag
  = | 'dietaVegetariano'
    | 'dietaVegano'
    | 'dietaSinGluten'
    | 'dietaSinLactosa'
    | 'dietaSinHuevo'
    | 'dietaKeto'
    | 'dietaHalal';

export interface OnboardingState {
  step: 1 | 2 | 3 | 4
  nombre: string
  sexo: SexoUsuario | null
  objetivo: ObjetivoUsuario | null
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
  dietaTextoLibre: string
  alergenosTextoLibre: string
  ingredientesOdiadosTextoLibre: string
  cocinasTextoLibre: string
  presupuestoSemanaEuros: number | null
  planningMeals: TipoPlatoSlot[]
  planningDays: DiaSemana[]
  nivelExperiencia: NivelExperienciaCulinaria | null
  setStep: (step: 1 | 2 | 3 | 4) => void
  setNombre: (value: string) => void
  setSexo: (value: SexoUsuario) => void
  setObjetivo: (value: ObjetivoUsuario) => void
  toggleDieta: (field: DietaFlag) => void
  toggleAlergeno: (value: string) => void
  toggleIngredienteOdiado: (value: string) => void
  toggleCocina: (value: TipoCocina) => void
  setAdultos: (value: number) => void
  setNinos: (value: number) => void
  setDietaTextoLibre: (value: string) => void
  setAlergenosTextoLibre: (value: string) => void
  setIngredientesOdiadosTextoLibre: (value: string) => void
  setCocinasTextoLibre: (value: string) => void
  setPresupuestoSemanaEuros: (value: number | null) => void
  toggleMeal: (value: TipoPlatoSlot) => void
  toggleDay: (value: DiaSemana) => void
  selectAllDays: () => void
  selectNoDays: () => void
  setNivelExperiencia: (value: NivelExperienciaCulinaria) => void
  reset: () => void
}

const initialState = {
  step: 1 as const,
  nombre: '',
  sexo: null as SexoUsuario | null,
  objetivo: null as ObjetivoUsuario | null,
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
  dietaTextoLibre: '',
  alergenosTextoLibre: '',
  ingredientesOdiadosTextoLibre: '',
  cocinasTextoLibre: '',
  presupuestoSemanaEuros: null as number | null,
  planningMeals: ['desayuno', 'comida', 'cena'] as TipoPlatoSlot[],
  planningDays: ALL_DIAS_SEMANA,
  nivelExperiencia: null as NivelExperienciaCulinaria | null,
};

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

// SSR-safe: `sessionStorage` doesn't exist during Next.js server rendering.
// `zustand/middleware`'s `createJSONStorage` calls this factory exactly
// ONCE at module load and caches the result — so the `typeof window` check
// must live INSIDE each method (re-evaluated per call), not around which
// object gets returned, or a module evaluated once with no `window` would
// be stuck on a no-op forever even after the client mounts.
function getOnboardingStorage(): Storage {
  return {
    getItem: key => (typeof window === 'undefined' ? null : window.sessionStorage.getItem(key)),
    setItem: (key, value) => {
      if (typeof window !== 'undefined') { window.sessionStorage.setItem(key, value); }
    },
    removeItem: (key) => {
      if (typeof window !== 'undefined') { window.sessionStorage.removeItem(key); }
    },
    length: 0,
    clear: () => {},
    key: () => null,
  };
}

export const useOnboardingStore = create<OnboardingState>()(persist(set => ({
  ...initialState,
  setStep: step => set({ step }),
  setNombre: nombre => set({ nombre }),
  setSexo: sexo => set({ sexo }),
  setObjetivo: objetivo => set({ objetivo }),
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
  setDietaTextoLibre: value => set({ dietaTextoLibre: value }),
  setAlergenosTextoLibre: value => set({ alergenosTextoLibre: value }),
  setIngredientesOdiadosTextoLibre: value => set({ ingredientesOdiadosTextoLibre: value }),
  setCocinasTextoLibre: value => set({ cocinasTextoLibre: value }),
  setPresupuestoSemanaEuros: value => set({ presupuestoSemanaEuros: value }),
  toggleMeal: value => set(state => ({ planningMeals: toggleInArray(state.planningMeals, value) })),
  toggleDay: value => set(state => ({ planningDays: toggleInArray(state.planningDays, value) })),
  selectAllDays: () => set({ planningDays: ALL_DIAS_SEMANA }),
  selectNoDays: () => set({ planningDays: [] }),
  setNivelExperiencia: value => set({ nivelExperiencia: value }),
  reset: () => set(initialState),
}), {
  // FRESCO-94: an accidental F5 mid-onboarding wiped the wizard's answers
  // with no warning — this was a plain in-memory `create()`, and a reload
  // re-mounts the JS runtime from scratch. `sessionStorage` (not
  // `localStorage`) matches the defect's expected fix exactly: survives a
  // reload, still clears on tab close, same privacy footprint as before.
  name: 'fresco-onboarding',
  storage: createJSONStorage(getOnboardingStorage),
  partialize: state => ({
    step: state.step,
    nombre: state.nombre,
    sexo: state.sexo,
    objetivo: state.objetivo,
    dietaVegetariano: state.dietaVegetariano,
    dietaVegano: state.dietaVegano,
    dietaSinGluten: state.dietaSinGluten,
    dietaSinLactosa: state.dietaSinLactosa,
    dietaSinHuevo: state.dietaSinHuevo,
    dietaKeto: state.dietaKeto,
    dietaHalal: state.dietaHalal,
    alergenos: state.alergenos,
    ingredientesOdiados: state.ingredientesOdiados,
    cocinasFavoritas: state.cocinasFavoritas,
    adultos: state.adultos,
    ninos: state.ninos,
    dietaTextoLibre: state.dietaTextoLibre,
    alergenosTextoLibre: state.alergenosTextoLibre,
    ingredientesOdiadosTextoLibre: state.ingredientesOdiadosTextoLibre,
    cocinasTextoLibre: state.cocinasTextoLibre,
    presupuestoSemanaEuros: state.presupuestoSemanaEuros,
    planningMeals: state.planningMeals,
    planningDays: state.planningDays,
    nivelExperiencia: state.nivelExperiencia,
  }),
}));
