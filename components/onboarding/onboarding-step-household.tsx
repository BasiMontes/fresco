'use client';

import type * as React from 'react';
import type { HouseholdValidationResult } from '@/lib/validation/onboarding';
import { useState } from 'react';
import { PlanningSelectionGrid } from '@/components/onboarding/planning-selection-grid';
import { Input } from '@/components/ui/input';
import { useOnboardingStore } from '@/lib/store/onboarding-store';

export interface OnboardingStepHouseholdProps {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  household: HouseholdValidationResult
  presupuestoValid: boolean
  hasInvalidPlanning: boolean
}

/**
 * FRESCO-166/FRESCO-371 — wizard step 3 (household size, weekly budget,
 * planning days/meals). Extracted from `app/onboarding/page.tsx` (A5-M1,
 * god-component split) — reads/writes the shared `useOnboardingStore()`
 * directly; `household`/`presupuestoValid`/`hasInvalidPlanning` stay
 * parent-computed because they also gate the footer's "Ver resumen" CTA
 * (FRESCO-755; it was "Generar mi menú" before the summary step), which lives
 * outside this step's JSX. `presupuestoTouched` is
 * step-3-local display-only UI state (gates whether the invalid-budget
 * message shows, not the CTA's disabled state) so it moved in here. No
 * behavior change from the original inline JSX.
 */
export function OnboardingStepHousehold({ headingRef, household, presupuestoValid, hasInvalidPlanning }: OnboardingStepHouseholdProps) {
  const { adultos, ninos, presupuestoSemanaEuros, planningSelection, setAdultos, setNinos, setPresupuestoSemanaEuros, setPlanningSelection } = useOnboardingStore();
  // FRESCO-371: presupuesto is optional again, but a typed-in 0/negative is
  // still invalid — this flag gates the "> 0" error styling/message so it
  // only shows after the field has been touched, never on a pristine visit.
  const [presupuestoTouched, setPresupuestoTouched] = useState(false);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="text-h3 outline-hidden">¿Quiénes cocináis en casa?</h1>
      <p className="mt-1 text-body-sm text-tertiary">Ajustaremos las cantidades del menú.</p>
      <div className="mt-4 flex gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-body-sm text-tertiary">Adultos</span>
          <Input
            data-testid="adultos_input"
            type="number"
            min={0}
            max={10}
            value={adultos}
            onChange={e => setAdultos(Number(e.target.value))}
            className={`max-w-24 ${!household.valid ? 'border-error' : ''}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-body-sm text-tertiary">Niños</span>
          <Input
            data-testid="ninos_input"
            type="number"
            min={0}
            max={10}
            value={ninos}
            onChange={e => setNinos(Number(e.target.value))}
            className={`max-w-24 ${!household.valid ? 'border-error' : ''}`}
          />
        </label>
      </div>
      {!household.valid && (
        <p data-testid="household_validation_message" role="alert" aria-live="polite" className="mt-2 text-body-sm text-error">
          {household.message}
        </p>
      )}

      {/* FRESCO-371 (A4-H14): budget is optional again. The engine
          never gates on it — `generate-meal-plan/menu-selector.ts`
          only appends one advisory string to `advertencias` if the
          finished plan's summed price exceeds it, and tolerates
          null. Making it required (FRESCO-263) cost a wizard step
          the PRD does not allow. */}
      <label className="mt-4 flex flex-col gap-1">
        <span className="text-body-sm text-tertiary">Presupuesto semanal (opcional)</span>
        <Input
          data-testid="presupuesto_input"
          type="number"
          min={1}
          value={presupuestoSemanaEuros ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            setPresupuestoSemanaEuros(raw === '' ? null : Number(raw));
          }}
          onBlur={() => setPresupuestoTouched(true)}
          placeholder="Ej. 80"
          className={`max-w-32 ${!presupuestoValid && presupuestoTouched ? 'border-error' : ''}`}
        />
      </label>
      {!presupuestoValid && presupuestoTouched && (
        <p data-testid="presupuesto_validation_message" role="alert" aria-live="polite" className="mt-2 text-body-sm text-error">
          El presupuesto debe ser mayor que 0.
        </p>
      )}

      <h2 className="mt-6 text-h5">¿Qué comidas quieres planificar y en qué días?</h2>
      <p className="mt-1 text-body-sm text-tertiary">Por defecto planificamos las 3 comidas los 7 días — desmarca cualquier combinación que no necesites.</p>
      <div className="mt-3">
        <PlanningSelectionGrid
          data-testid="planning_selection_grid"
          value={planningSelection}
          onChange={setPlanningSelection}
        />
      </div>

      {hasInvalidPlanning && (
        <p data-testid="planning_validation_message" role="alert" aria-live="polite" className="mt-2 text-body-sm text-error">
          Selecciona al menos un día y una comida para generar tu menú.
        </p>
      )}
    </>
  );
}
