'use client';

import type * as React from 'react';
import type { DietaFlag } from '@/lib/store/onboarding-store';
import { useState } from 'react';
import { LegalModal } from '@/components/legal/legal-modal';
import { LockInfoTooltip } from '@/components/onboarding/lock-info-tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/tag';
import { ALERGENO_OPTIONS, impliedAlergenos, INGREDIENTE_ODIADO_OPTIONS } from '@/lib/constants/dietary-options';
import { CONSENT_TEXTS } from '@/lib/legal/consent';
import { postConsents } from '@/lib/legal/consent-client';
import { collectsHealthData } from '@/lib/onboarding/health-data-consent';
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
    healthDataConsent,
    setHealthDataConsent,
    toggleDieta,
    toggleAlergeno,
    toggleIngredienteOdiado,
    toggleCocina,
    setDietaTextoLibre,
    setIngredientesOdiadosTextoLibre,
    setCocinasTextoLibre,
  } = useOnboardingStore();

  // FRESCO-794 (ADR-0040): allergies and diet are health data (GDPR art. 9). The
  // box appears once the user picks any of them, is not pre-ticked, and the
  // wizard does not go on without it (`app/onboarding/page.tsx`). Ticking it
  // records the consent straight away; nothing is kept for a user who refuses.
  const needsHealthConsent = collectsHealthData({
    dietaVegetariano,
    dietaVegano,
    dietaSinGluten,
    dietaSinLactosa,
    dietaSinHuevo,
    dietaKeto,
    dietaHalal,
    alergenos,
    dietaTextoLibre,
  });
  const [isRecordingConsent, setIsRecordingConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  async function handleConsentChange(checked: boolean) {
    setConsentError(null);
    if (!checked) {
      // Unticking only blocks going on while health data is filled in; the
      // registry is append-only and withdrawal is a separate decision (ADR-0040).
      setHealthDataConsent(false);
      return;
    }
    setIsRecordingConsent(true);
    const recorded = await postConsents(['health_data']);
    setIsRecordingConsent(false);
    if (recorded) {
      setHealthDataConsent(true);
    }
    else {
      setConsentError('No pudimos registrar tu consentimiento. Inténtalo de nuevo.');
    }
  }

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

      {needsHealthConsent && (
        <div data-testid="health_consent_block" className="mt-4 rounded-md border border-border p-3">
          <p className="text-body-sm text-tertiary">
            Tus alergias y tu dieta son datos de salud. Solo los usamos para excluir las recetas que no te convienen, y necesitamos tu consentimiento explícito para guardarlos. Más información en la
            {' '}
            <button
              type="button"
              data-testid="health_consent_privacy_link"
              onClick={() => setPrivacyOpen(true)}
              className="text-primary underline"
            >
              Política de Privacidad
            </button>
            .
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-body-sm text-tertiary">
            <span className="flex size-6 shrink-0 items-center justify-center">
              {/* FRESCO-451: a single agree toggle, so the square variant. */}
              <Checkbox
                data-testid="health_consent_checkbox"
                checked={healthDataConsent}
                disabled={isRecordingConsent}
                onChange={e => void handleConsentChange(e.target.checked)}
                className="rounded-sm"
              />
            </span>
            <span>{CONSENT_TEXTS.health_data}</span>
          </label>
          {consentError && (
            <p data-testid="health_consent_error_message" role="alert" aria-live="assertive" className="mt-2 text-body-sm text-error">
              {consentError}
            </p>
          )}
          {!healthDataConsent && !consentError && (
            <p data-testid="health_consent_required_hint" role="status" aria-live="polite" className="mt-2 text-body-sm text-tertiary">
              Marca la casilla para continuar.
            </p>
          )}
        </div>
      )}
      <LegalModal open={privacyOpen} onOpenChange={setPrivacyOpen} section="privacidad" />

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
