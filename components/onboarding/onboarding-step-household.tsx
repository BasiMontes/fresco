'use client';

import type * as React from 'react';
import type { HouseholdValidationResult } from '@/lib/validation/onboarding';
import { useState } from 'react';
import { PlanningSelectionGrid } from '@/components/onboarding/planning-selection-grid';
import { Input } from '@/components/ui/input';
import { NumberStepper } from '@/components/ui/number-stepper';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { HOUSEHOLD_FIELD_MAX } from '@/lib/validation/onboarding';

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
  // The persisted household total is adultos + ninos (see validation/onboarding.ts).
  const personas = Math.max(1, adultos + ninos);
  const personasLabel = `${personas} ${personas === 1 ? 'persona' : 'personas'}`;
  const perPersonaEuros = presupuestoSemanaEuros !== null && presupuestoValid && Number.isFinite(presupuestoSemanaEuros)
    ? Math.round((presupuestoSemanaEuros / personas) * 10) / 10
    : null;

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="text-h3 outline-hidden">¿Quiénes cocináis en casa?</h1>
      <p className="mt-1 text-body-sm text-tertiary">Ajustaremos las cantidades del menú.</p>
      {/* FRESCO-1225: - / + steppers bounded by HOUSEHOLD_FIELD_MAX (FRESCO-382).
          Adults need at least one (validateHousehold). */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <span className="text-body-sm text-tertiary">Adultos</span>
          <NumberStepper label="Adultos" data-testid="adultos_input" min={1} max={HOUSEHOLD_FIELD_MAX} value={adultos} onChange={setAdultos} invalid={!household.valid} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-body-sm text-tertiary">Niños</span>
          <NumberStepper label="Niños" data-testid="ninos_input" min={0} max={HOUSEHOLD_FIELD_MAX} value={ninos} onChange={setNinos} invalid={!household.valid} />
        </div>
      </div>
      {!household.valid && (
        <p data-testid="household_validation_message" role="alert" aria-live="polite" className="mt-2 text-body-sm text-error">
          {household.message}
        </p>
      )}
      {/* Verified in generate-meal-plan/menu-selector.ts and generate-shopping-list:
          num_personas scales quantities and the budget comparison. */}
      <p data-testid="household_effect_hint" className="mt-2 text-body-sm text-tertiary">
        {`Esto cambia tu menú: las cantidades y el coste se calculan para ${personasLabel}.`}
      </p>

      {/* FRESCO-371 (A4-H14): budget is optional again. The engine
          never gates on it — `generate-meal-plan/menu-selector.ts`
          only appends one advisory string to `advertencias` if the
          finished plan's summed price exceeds it, and tolerates
          null. Making it required (FRESCO-263) cost a wizard step
          the PRD does not allow. */}
      <label className="mt-4 flex flex-col gap-1">
        <span className="text-body-sm text-tertiary">Presupuesto semanal (opcional)</span>
        <span className="flex items-center gap-2">
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
            aria-describedby="presupuesto_help"
            className={`max-w-32 ${!presupuestoValid && presupuestoTouched ? 'border-error' : ''}`}
          />
          <span aria-hidden="true" className="text-body-sm text-tertiary">EUR</span>
        </span>
      </label>
      <p id="presupuesto_help" data-testid="presupuesto_help" className="mt-1 text-body-sm text-tertiary">
        {perPersonaEuros !== null
          ? `Son unos ${perPersonaEuros} EUR por persona y semana (${personasLabel}). Esto cambia tu menú: te avisamos si se pasa de ese importe.`
          : `Opcional. Esto cambia tu menú: si lo indicas, te avisamos cuando el menú de ${personasLabel} se pase.`}
      </p>
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
