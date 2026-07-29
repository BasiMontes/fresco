'use client';

import type { TipoCocina } from '@schemas';
import type { DietaFlag } from '@/lib/store/onboarding-store';
import { useRouter } from 'next/navigation';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/tag';
import { EdgeFunctionError, generateMealPlan } from '@/lib/api/edge-functions';
import { upsertUserProfile } from '@/lib/api/user-profile';
import { ALERGENO_OPTIONS, INGREDIENTE_ODIADO_OPTIONS } from '@/lib/constants/dietary-options';
import { getIsoWeek, getIsoWeekMonday } from '@/lib/date/iso-week';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { createClient } from '@/lib/supabase/client';
import { validateHousehold } from '@/lib/validation/onboarding';

/**
 * `/onboarding` — EPIC-FRESCO-1 (US 1.1/1.2: 3-step onboarding, kept short
 * so a guest doesn't abandon before reaching any value — user-journeys.md
 * Journey 1, Step 2). Single route driving all 3 steps internally (judgment
 * call, see report) rather than 3 separate routes.
 *
 * FRESCO-5 extends this scaffold with the full FR-1.1 profile (diet,
 * allergens, disliked ingredients, favorite cuisines, household size) and
 * persists it to `user_profiles` before continuing on to menu generation.
 */

const DIETA_OPTIONS: { value: DietaFlag, label: string }[] = [
  { value: 'dietaVegetariano', label: 'Vegetariano' },
  { value: 'dietaVegano', label: 'Vegano' },
  { value: 'dietaSinGluten', label: 'Sin gluten' },
  { value: 'dietaSinLactosa', label: 'Sin lactosa' },
  { value: 'dietaSinHuevo', label: 'Sin huevo' },
  { value: 'dietaKeto', label: 'Keto' },
  { value: 'dietaHalal', label: 'Halal' },
];

const COCINA_OPTIONS: { value: TipoCocina, label: string }[] = [
  { value: 'española', label: 'Española' },
  { value: 'italiana', label: 'Italiana' },
  { value: 'mexicana', label: 'Mexicana' },
  { value: 'asiática', label: 'Asiática' },
  { value: 'mediterránea', label: 'Mediterránea' },
  { value: 'latina', label: 'Latina' },
  { value: 'internacional', label: 'Internacional' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const {
    step,
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
    adultos,
    ninos,
    setStep,
    toggleDieta,
    toggleAlergeno,
    toggleIngredienteOdiado,
    toggleCocina,
    setAdultos,
    setNinos,
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

  const household = validateHousehold({ adultos, ninos });

  async function handleGenerate() {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const client = createClient();
      // AC-4 / FR-1.1: persist the full onboarding profile before continuing.
      // Assumes an authenticated session already exists — guest-mode
      // onboarding is explicitly out of scope for this story.
      await upsertUserProfile(client, {
        num_personas: adultos + ninos,
        adultos,
        ninos,
        dieta_vegetariano: dietaVegetariano,
        dieta_vegano: dietaVegano,
        dieta_sin_gluten: dietaSinGluten,
        dieta_sin_lactosa: dietaSinLactosa,
        dieta_sin_huevo: dietaSinHuevo,
        dieta_keto: dietaKeto,
        dieta_halal: dietaHalal,
        alergenos,
        ingredientes_odiados: ingredientesOdiados,
        cocinas_favoritas: cocinasFavoritas,
      });

      const now = new Date();
      const semanaIso = getIsoWeek(now);
      const fechaInicio = getIsoWeekMonday(now);
      // Guest-mode auth (a visitor with no account yet) is still unresolved —
      // see business-api-map.md — but a signed-in user's real session token
      // was never read here even when one exists, which 401'd unconditionally.
      const { data: { session } } = await client.auth.getSession();
      await generateMealPlan(
        { semana_iso: semanaIso, fecha_inicio: fechaInicio },
        session?.access_token ?? null,
      );
      router.push('/menu');
    }
    catch (error) {
      // AC-4 ("La generación no puede producir un menú válido"): index.ts
      // throws a 422 only when no valid 21-slot menu could be assembled
      // after retries — a distinct, expected case from a genuine upstream
      // failure (Gemini call error, thrown as 502), so it gets its own clear
      // message instead of being conflated with the generic fallback.
      if (error instanceof EdgeFunctionError && error.status === 422) {
        setGenerateError(
          'No pudimos generar un menú válido con tus restricciones actuales. Prueba a ampliar tus preferencias o inténtalo de nuevo más tarde.',
        );
      }
      else {
        setGenerateError('No pudimos guardar tu perfil o generar tu menú. Intenta de nuevo.');
      }
    }
    finally {
      setIsGenerating(false);
    }
  }

  return (
    <div data-testid="onboardingPage" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
      <p data-testid="step_indicator_label" className="text-caption uppercase text-tertiary">
        Paso
        {' '}
        {step}
        {' '}
        de 3
      </p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-surface'}`} />
        ))}
      </div>

      <Card className="mt-6">
        {step === 1 && (
          <>
            <h1 className="text-h3">¿Qué dieta y restricciones sigue tu hogar?</h1>
            <p className="mt-1 text-body-sm text-tertiary">Puedes elegir varias.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {DIETA_OPTIONS.map((option) => {
                // AC-2: "vegana" always implies "vegetariana" — the
                // vegetariano chip stays visually locked selected whenever
                // vegano is active, and cannot be toggled off from here.
                const isLocked = option.value === 'dietaVegetariano' && dietaVegano;
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-testid="dieta_option"
                    disabled={isLocked}
                    onClick={() => toggleDieta(option.value)}
                  >
                    <Tag variant={dietaState[option.value] ? 'selected' : 'outline'}>
                      {option.label}
                    </Tag>
                  </button>
                );
              })}
            </div>

            <h2 className="mt-6 text-h5">¿Algún alérgeno que debamos evitar?</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {ALERGENO_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  data-testid="alergeno_option"
                  onClick={() => toggleAlergeno(option.value)}
                >
                  <Tag variant={alergenos.includes(option.value) ? 'selected' : 'outline'}>
                    {option.label}
                  </Tag>
                </button>
              ))}
            </div>

            <h2 className="mt-6 text-h5">¿Algún ingrediente que no te guste?</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {INGREDIENTE_ODIADO_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  data-testid="ingrediente_odiado_option"
                  onClick={() => toggleIngredienteOdiado(option.value)}
                >
                  <Tag variant={ingredientesOdiados.includes(option.value) ? 'selected' : 'outline'}>
                    {option.label}
                  </Tag>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-h3">¿Cuáles son tus cocinas favoritas?</h1>
            <p className="mt-1 text-body-sm text-tertiary">Puedes elegir varias.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {COCINA_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  data-testid="cocina_option"
                  onClick={() => toggleCocina(option.value)}
                >
                  <Tag variant={cocinasFavoritas.includes(option.value) ? 'selected' : 'outline'}>
                    {option.label}
                  </Tag>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-h3">¿Quiénes cocináis en casa?</h1>
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
              <p data-testid="household_validation_message" className="mt-2 text-body-sm text-error">
                {household.message}
              </p>
            )}
          </>
        )}

        {generateError && (
          <p data-testid="generate_error_message" className="mt-4 text-body-sm text-error">
            {generateError}
          </p>
        )}

        <div className="mt-6 flex justify-between">
          <Button
            data-testid="back_button"
            variant="secondary"
            onClick={() => setStep((step > 1 ? step - 1 : 1) as 1 | 2 | 3)}
            disabled={step === 1}
          >
            Atrás
          </Button>
          {step < 3
            ? (
                <Button data-testid="next_button" onClick={() => setStep((step + 1) as 1 | 2 | 3)}>
                  Siguiente
                </Button>
              )
            : (
                <Button
                  data-testid="generate_menu_button"
                  variant="action"
                  onClick={() => {
                    void handleGenerate();
                  }}
                  disabled={isGenerating || !household.valid}
                >
                  {isGenerating ? 'Generando menú…' : 'Generar mi menú'}
                </Button>
              )}
        </div>
      </Card>
    </div>
  );
}
