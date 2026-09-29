'use client';

import type * as React from 'react';
import type { DietaFlag } from '@/lib/store/onboarding-store';
import { LockInfoTooltip } from '@/components/onboarding/lock-info-tooltip';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/tag';
import { ALERGENO_OPTIONS, impliedAlergenos, INGREDIENTE_ODIADO_OPTIONS } from '@/lib/constants/dietary-options';
import { alergenoLockMessage, COCINA_OPTIONS, DIETA_OPTIONS, UNSELECTED_CHIP_CLASS } from '@/lib/onboarding/wizard-options';
import { useOnboardingStore } from '@/lib/store/onboarding-store';

export interface OnboardingStepDietProps {
  headingRef: React.RefObject<HTMLHeadingElement | null>
}

/**
 * FRESCO-5/FRESCO-371 — wizard step 2 (dieta, alérgenos, ingredientes que no
 * gustan, cocinas favoritas). Extracted from `app/onboarding/page.tsx`
 * (A5-M1, god-component split) — reads/writes the shared
 * `useOnboardingStore()` directly, no behavior change from the original
 * inline JSX.
 */
export function OnboardingStepDiet({ headingRef }: OnboardingStepDietProps) {
  const {
    dietaVegetariano,
    dietaVegano,
    dietaSinGluten,
    dietaSinLactosa,
    dietaSinHuevo,
    dietaKeto,
    dietaHalal,
    alergenos,
    ingredientesOdiados,
    cocinasFavoritas,
    dietaTextoLibre,
    ingredientesOdiadosTextoLibre,
    cocinasTextoLibre,
    toggleDieta,
    toggleAlergeno,
    toggleIngredienteOdiado,
    toggleCocina,
    setDietaTextoLibre,
    setIngredientesOdiadosTextoLibre,
    setCocinasTextoLibre,
  } = useOnboardingStore();

  const dietaState: Record<DietaFlag, boolean> = {
    dietaVegetariano,
    dietaVegano,
    dietaSinGluten,
    dietaSinLactosa,
    dietaSinHuevo,
    dietaKeto,
    dietaHalal,
  };

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="text-h3 outline-hidden">¿Qué dieta y restricciones sigue tu hogar?</h1>
      <p className="mt-1 text-body-sm text-tertiary">Puedes elegir varias.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {DIETA_OPTIONS.map((option) => {
          // AC-2: "vegana" always implies "vegetariana" — the
          // vegetariano chip stays visually locked selected whenever
          // vegano is active, and cannot be toggled off from here.
          const isLocked = option.value === 'dietaVegetariano' && dietaVegano;
          return (
            <span key={option.value} className="inline-flex items-center gap-1">
              <button
                type="button"
                data-testid="dieta_option"
                disabled={isLocked}
                aria-pressed={dietaState[option.value]}
                onClick={() => toggleDieta(option.value)}
              >
                <Tag variant={dietaState[option.value] ? 'selected' : 'outline'} className={dietaState[option.value] ? undefined : UNSELECTED_CHIP_CLASS}>
                  {option.label}
                </Tag>
              </button>
              {isLocked && (
                <LockInfoTooltip
                  testIdPrefix="dieta_vegetariano"
                  message="Vegano incluye vegetariano — todas las recetas veganas son también vegetarianas."
                />
              )}
            </span>
          );
        })}
      </div>
      <Input
        data-testid="dieta_texto_libre_input"
        type="text"
        value={dietaTextoLibre}
        onChange={e => setDietaTextoLibre(e.target.value)}
        placeholder="¿Algo más que debamos saber?"
        aria-label="Dieta y restricciones — texto libre"
        className="mt-2"
      />

      <h2 className="mt-6 text-h5">¿Algún alérgeno que debamos evitar?</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ALERGENO_OPTIONS.map((option) => {
          const dietaFlags = { vegano: dietaVegano, vegetariano: dietaVegetariano, sinGluten: dietaSinGluten };
          const isLocked = impliedAlergenos(dietaFlags).includes(option.value);
          return (
            <span key={option.value} className="inline-flex items-center gap-1">
              <button
                type="button"
                data-testid="alergeno_option"
                disabled={isLocked}
                aria-pressed={alergenos.includes(option.value)}
                onClick={() => toggleAlergeno(option.value)}
              >
                <Tag variant={alergenos.includes(option.value) ? 'selected' : 'outline'} className={alergenos.includes(option.value) ? undefined : UNSELECTED_CHIP_CLASS}>
                  {option.label}
                </Tag>
              </button>
              {isLocked && (
                <LockInfoTooltip
                  testIdPrefix={`alergeno_${option.value}`}
                  message={alergenoLockMessage(option.value, dietaFlags)}
                />
              )}
            </span>
          );
        })}
      </div>

      <h2 className="mt-6 text-h5">¿Algún ingrediente que no te guste?</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {INGREDIENTE_ODIADO_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            data-testid="ingrediente_odiado_option"
            aria-pressed={ingredientesOdiados.includes(option.value)}
            onClick={() => toggleIngredienteOdiado(option.value)}
          >
            <Tag variant={ingredientesOdiados.includes(option.value) ? 'selected' : 'outline'} className={ingredientesOdiados.includes(option.value) ? undefined : UNSELECTED_CHIP_CLASS}>
              {option.label}
            </Tag>
          </button>
        ))}
      </div>
      <Input
        data-testid="ingredientes_odiados_texto_libre_input"
        type="text"
        value={ingredientesOdiadosTextoLibre}
        onChange={e => setIngredientesOdiadosTextoLibre(e.target.value)}
        placeholder="¿Algún otro ingrediente que no te guste?"
        aria-label="Ingredientes que no gustan — texto libre"
        className="mt-2"
      />

      {/* FRESCO-371: cuisines folded in from the old standalone step 3
          so the wizard fits the PRD's 3-step limit — it's the same
          kind of low-friction chip input as the rows above. */}
      <h2 className="mt-6 text-h5">¿Cuáles son tus cocinas favoritas?</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {COCINA_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            data-testid="cocina_option"
            aria-pressed={cocinasFavoritas.includes(option.value)}
            onClick={() => toggleCocina(option.value)}
          >
            <Tag variant={cocinasFavoritas.includes(option.value) ? 'selected' : 'outline'} className={cocinasFavoritas.includes(option.value) ? undefined : UNSELECTED_CHIP_CLASS}>
              {option.label}
            </Tag>
          </button>
        ))}
      </div>
      <Input
        data-testid="cocinas_texto_libre_input"
        type="text"
        value={cocinasTextoLibre}
        onChange={e => setCocinasTextoLibre(e.target.value)}
        placeholder="¿Alguna otra cocina que te guste?"
        aria-label="Cocinas favoritas — texto libre"
        className="mt-2"
      />
    </>
  );
}
