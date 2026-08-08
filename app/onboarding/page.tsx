'use client';

import type { TipoCocina } from '@schemas';
import type { DietaFlag } from '@/lib/store/onboarding-store';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/tag';
import { EdgeFunctionError, generateMealPlan } from '@/lib/api/edge-functions';
import { upsertUserProfile, UserProfileError } from '@/lib/api/user-profile';
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
  const [sessionError, setSessionError] = useState<string | null>(null);

  // FRESCO-17 (Guest Mode, US 6.1): a first-time visitor reaches this page
  // with no Supabase session at all. Ensure one exists before she can reach
  // Step 3 — a just-registered user arriving from `/signup` already has a
  // real session, so this only fires for an actual guest (ADR-0003).
  useEffect(() => {
    async function ensureGuestSession() {
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      if (session) {
        return;
      }
      const { error } = await client.auth.signInAnonymously();
      if (error) {
        // Real, previously-observed failure mode (ADR-0003: anonymous
        // sign-ins are rate-limited), not a speculative one.
        setSessionError('No pudimos iniciar tu visita como invitada. Recarga la página e inténtalo de nuevo.');
      }
    }
    void ensureGuestSession();
  }, []);
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

  // A11y: the wizard swaps step content in place (single route) — without
  // this, a screen-reader/keyboard user gets no signal the content changed
  // when advancing/going back, since focus stays wherever it was.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step]);

  async function handleGenerate() {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const client = createClient();
      // AC-4 / FR-1.1: persist the full onboarding profile before continuing.
      // A session (real or anonymous guest, FRESCO-17) is guaranteed by the
      // mount effect above before this handler is reachable.
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
      // Guest or registered, a session now always exists (mount effect
      // above) — this just reads whichever token it is.
      const { data: { session } } = await client.auth.getSession();
      await generateMealPlan(
        { semana_iso: semanaIso, fecha_inicio: fechaInicio },
        session?.access_token ?? null,
      );
      // FRESCO-94: the store now persists to sessionStorage so a mid-wizard
      // reload survives — reset here so a later same-tab visit to
      // /onboarding doesn't resurface this run's stale answers.
      useOnboardingStore.getState().reset();
      router.push('/menu');
    }
    catch (error) {
      // FRESCO (2026-08-08, live bug report): this catch used to collapse
      // every failure mode into one generic message — a real network drop,
      // an expired/missing session, a genuine server error, and the
      // catalog-too-small case were all indistinguishable to the user (and
      // to us debugging her report afterward). Each branch below is a real,
      // previously-observed failure mode, not speculative:
      // AC-4 ("La generación no puede producir un menú válido"): index.ts
      // throws a 422 only when the filtered candidate catalog itself is too
      // small (fewer than 21 safe recipes after allergen/diet filtering).
      if (error instanceof EdgeFunctionError && error.status === 422) {
        setGenerateError(
          'No pudimos generar un menú válido con tus restricciones actuales. Prueba a ampliar tus preferencias o inténtalo de nuevo más tarde.',
        );
      }
      // A network failure (offline, connection dropped mid-request, DNS
      // failure) surfaces as a plain TypeError from `fetch` itself — never
      // reaches the EdgeFunctionError/UserProfileError branches below,
      // since those require a real HTTP response to construct.
      else if (error instanceof TypeError) {
        setGenerateError(
          'No pudimos conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.',
        );
      }
      else if (error instanceof UserProfileError) {
        // UserProfileError's own message is already a complete, user-facing
        // Spanish sentence (see lib/api/user-profile.ts) — don't re-wrap it.
        setGenerateError(error.message);
      }
      else if (error instanceof EdgeFunctionError) {
        setGenerateError(
          `No pudimos generar tu menú (error del servidor, código ${error.status}). Inténtalo de nuevo en unos segundos.`,
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
      {sessionError && (
        <p data-testid="session_error_message" role="alert" aria-live="assertive" className="mb-4 text-body-sm text-error">
          {sessionError}
        </p>
      )}
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
            <h1 ref={stepHeadingRef} tabIndex={-1} className="text-h3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">¿Qué dieta y restricciones sigue tu hogar?</h1>
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
                    aria-pressed={dietaState[option.value]}
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
                  aria-pressed={alergenos.includes(option.value)}
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
                  aria-pressed={ingredientesOdiados.includes(option.value)}
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
            <h1 ref={stepHeadingRef} tabIndex={-1} className="text-h3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">¿Cuáles son tus cocinas favoritas?</h1>
            <p className="mt-1 text-body-sm text-tertiary">Puedes elegir varias.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {COCINA_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  data-testid="cocina_option"
                  aria-pressed={cocinasFavoritas.includes(option.value)}
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
            <h1 ref={stepHeadingRef} tabIndex={-1} className="text-h3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">¿Quiénes cocináis en casa?</h1>
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
          </>
        )}

        {generateError && (
          <p data-testid="generate_error_message" role="alert" aria-live="assertive" className="mt-4 text-body-sm text-error">
            {generateError}
          </p>
        )}

        {isGenerating && (
          // ADR-0005: menu-slot selection is now a deterministic algorithm
          // (~2-3s observed live), not a per-call Gemini generation — the
          // old "puede tardar hasta un minuto" copy overstated the real
          // wait once that shipped. Kept the spinner + hint pattern itself
          // (still reassuring during any wait, however short), just
          // corrected what it claims.
          <p data-testid="generating_hint" role="status" aria-live="polite" className="mt-4 text-body-sm text-tertiary">
            Preparando tu menú…
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
                  {isGenerating
                    ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          Generando menú…
                        </>
                      )
                    : (
                        'Generar mi menú'
                      )}
                </Button>
              )}
        </div>
      </Card>
    </div>
  );
}
