import { create } from 'zustand';

/**
 * Client-side state for the 3-step onboarding flow (EPIC-FRESCO-1: diet,
 * favorite cuisines, household size). A single route (`/onboarding`) drives
 * all 3 steps internally rather than 3 separate routes — judgment call, see
 * report: keeps the guest's "3 steps only" promise (user-journeys.md
 * Journey 1, Step 2) legible as one continuous flow instead of full-page
 * navigations between steps.
 */

export type DietaBase = 'omnivoro' | 'vegetariano' | 'vegano' | 'sin_gluten' | 'sin_lactosa';

export interface OnboardingState {
  step: 1 | 2 | 3
  dieta: DietaBase[]
  cocinasFavoritas: string[]
  numPersonas: number
  setStep: (step: 1 | 2 | 3) => void
  toggleDieta: (value: DietaBase) => void
  toggleCocina: (value: string) => void
  setNumPersonas: (value: number) => void
  reset: () => void
}

const initialState = {
  step: 1 as const,
  dieta: [] as DietaBase[],
  cocinasFavoritas: [] as string[],
  numPersonas: 2,
};

export const useOnboardingStore = create<OnboardingState>(set => ({
  ...initialState,
  setStep: step => set({ step }),
  toggleDieta: value =>
    set(state => ({
      dieta: state.dieta.includes(value)
        ? state.dieta.filter(item => item !== value)
        : [...state.dieta, value],
    })),
  toggleCocina: value =>
    set(state => ({
      cocinasFavoritas: state.cocinasFavoritas.includes(value)
        ? state.cocinasFavoritas.filter(item => item !== value)
        : [...state.cocinasFavoritas, value],
    })),
  setNumPersonas: value => set({ numPersonas: value }),
  reset: () => set(initialState),
}));
