'use client';

import type { DiaSemana, NivelExperienciaCulinaria, ObjetivoUsuario, SexoUsuario, TipoCocina, TipoPlatoSlot } from '@schemas';
import type { DietaFlag } from '@/lib/store/onboarding-store';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dropdown } from '@/components/ui/dropdown';
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
 * `/onboarding` — EPIC-FRESCO-1 (US 1.1/1.2: 4-step onboarding, kept short
 * so a guest doesn't abandon before reaching any value — user-journeys.md
 * Journey 1, Step 2). Single route driving all 4 steps internally (judgment
 * call, see report) rather than separate routes.
 *
 * FRESCO-5 extends this scaffold with the full FR-1.1 profile (diet,
 * allergens, disliked ingredients, favorite cuisines, household size) and
 * persists it to `user_profiles` before continuing on to menu generation.
 * FRESCO-132 adds step 1 (name, sex, goal) — more signal for recommendations.
 */

const SEXO_OPTIONS: { value: SexoUsuario, label: string }[] = [
  { value: 'mujer', label: 'Mujer' },
  { value: 'hombre', label: 'Hombre' },
  { value: 'otro', label: 'Otro' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decirlo' },
];

const OBJETIVO_OPTIONS: { value: ObjetivoUsuario, label: string }[] = [
  { value: 'perder_peso', label: 'Perder peso' },
  { value: 'comer_sano', label: 'Comer sano' },
  { value: 'ahorrar_dinero', label: 'Ahorrar dinero' },
  { value: 'ganar_masa_muscular', label: 'Ganar masa muscular' },
  { value: 'comer_variado', label: 'Comer más variado' },
  { value: 'reducir_desperdicio', label: 'Reducir desperdicio de comida' },
];

const NIVEL_EXPERIENCIA_OPTIONS: { value: NivelExperienciaCulinaria, label: string }[] = [
  { value: 'aprendiz', label: 'Aprendiz' },
  { value: 'novato', label: 'Novato' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'chef', label: 'Chef' },
  { value: 'experto', label: 'Experto' },
];

const MEAL_OPTIONS: { value: TipoPlatoSlot, label: string }[] = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida', label: 'Almuerzo' },
  { value: 'cena', label: 'Cena' },
];

const DAY_OPTIONS: { value: DiaSemana, label: string }[] = [
  { value: 'lunes', label: 'Lun' },
  { value: 'martes', label: 'Mar' },
  { value: 'miercoles', label: 'Mié' },
  { value: 'jueves', label: 'Jue' },
  { value: 'viernes', label: 'Vie' },
  { value: 'sabado', label: 'Sáb' },
  { value: 'domingo', label: 'Dom' },
];

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

// FRESCO-104: distinct from the generic fallback below — a 409 here can
// never be resolved by retrying (the week already has a plan), so it gets
// its own message + a real exit link instead of the generic "intenta de
// nuevo". Same wording as components/calendar/generate-week-button.tsx's
// 409 branch.
const EXISTING_MENU_FOR_WEEK_MESSAGE = 'Ya existe un menú para esta semana.';

export default function OnboardingPage() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const hasExistingMenu = generateError === EXISTING_MENU_FOR_WEEK_MESSAGE;
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [vegetarianoLockTooltipOpen, setVegetarianoLockTooltipOpen] = useState(false);

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
    nombre,
    sexo,
    objetivo,
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
    dietaTextoLibre,
    alergenosTextoLibre,
    ingredientesOdiadosTextoLibre,
    cocinasTextoLibre,
    presupuestoSemanaEuros,
    planningMeals,
    planningDays,
    nivelExperiencia,
    setStep,
    setNombre,
    setSexo,
    setObjetivo,
    toggleDieta,
    toggleAlergeno,
    toggleIngredienteOdiado,
    toggleCocina,
    setAdultos,
    setNinos,
    setDietaTextoLibre,
    setAlergenosTextoLibre,
    setIngredientesOdiadosTextoLibre,
    setCocinasTextoLibre,
    setPresupuestoSemanaEuros,
    toggleMeal,
    toggleDay,
    selectAllDays,
    selectNoDays,
    setNivelExperiencia,
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
  // DB check constraint: presupuesto_semana_euros > 0 — null (unset) is
  // valid, only an explicit non-positive value is rejected.
  const presupuestoValid = presupuestoSemanaEuros === null || presupuestoSemanaEuros > 0;

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
    setGenerateSuccess(false);
    try {
      const client = createClient();
      // AC-4 / FR-1.1: persist the full onboarding profile before continuing.
      // A session (real or anonymous guest, FRESCO-17) is guaranteed by the
      // mount effect above before this handler is reachable.
      await upsertUserProfile(client, {
        nombre,
        sexo,
        objetivo,
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
        dieta_texto_libre: dietaTextoLibre,
        alergenos_texto_libre: alergenosTextoLibre,
        ingredientes_odiados_texto_libre: ingredientesOdiadosTextoLibre,
        cocinas_texto_libre: cocinasTextoLibre,
        // DB check constraint: presupuesto_semana_euros > 0 — 0/negative
        // rejected, only a genuine positive value or null is valid.
        presupuesto_semana_euros: presupuestoSemanaEuros,
        planning_meals: planningMeals,
        planning_days: planningDays,
        nivel_experiencia: nivelExperiencia,
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
      // FRESCO-152: brief explicit confirmation before leaving — the
      // redirect used to fire immediately with no acknowledgment that
      // the generation actually succeeded.
      setGenerateSuccess(true);
      await new Promise(resolve => setTimeout(resolve, 900));
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
      // FRESCO-104: index.ts throws 409 when a plan for this week already
      // exists — reintentar el formulario nunca lo resuelve. Mismo caso que
      // components/calendar/generate-week-button.tsx ya maneja.
      else if (error instanceof EdgeFunctionError && error.status === 409) {
        setGenerateError(EXISTING_MENU_FOR_WEEK_MESSAGE);
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
        de 4
      </p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-surface'}`} />
        ))}
      </div>

      <Card className="mt-6">
        {step === 1 && (
          <>
            <h1 ref={stepHeadingRef} tabIndex={-1} className="text-h3 outline-none">Cuéntanos sobre ti</h1>
            <p className="mt-1 text-body-sm text-tertiary">Nos ayuda a afinar las recomendaciones. Todo es opcional.</p>

            <label className="mt-4 flex flex-col gap-1">
              <span className="text-body-sm text-tertiary">Nombre</span>
              <Input
                data-testid="nombre_input"
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="¿Cómo te llamas?"
              />
            </label>

            <label className="mt-4 flex flex-col gap-1">
              <span className="text-body-sm text-tertiary">Sexo</span>
              <Dropdown
                data-testid="sexo_dropdown"
                aria-label="Sexo"
                options={SEXO_OPTIONS}
                value={sexo}
                onChange={value => setSexo(value as SexoUsuario)}
                placeholder="Selecciona una opción"
              />
            </label>

            <label className="mt-4 flex flex-col gap-1">
              <span className="text-body-sm text-tertiary">Objetivo</span>
              <Dropdown
                data-testid="objetivo_dropdown"
                aria-label="Objetivo"
                options={OBJETIVO_OPTIONS}
                value={objetivo}
                onChange={value => setObjetivo(value as ObjetivoUsuario)}
                placeholder="¿Qué buscas conseguir?"
              />
            </label>

            <label className="mt-4 flex flex-col gap-1">
              <span className="text-body-sm text-tertiary">Nivel de experiencia culinaria</span>
              <Dropdown
                data-testid="nivel_experiencia_dropdown"
                aria-label="Nivel de experiencia culinaria"
                options={NIVEL_EXPERIENCIA_OPTIONS}
                value={nivelExperiencia}
                onChange={value => setNivelExperiencia(value as NivelExperienciaCulinaria)}
                placeholder="¿Cuánto sabes cocinar?"
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <h1 ref={stepHeadingRef} tabIndex={-1} className="text-h3 outline-none">¿Qué dieta y restricciones sigue tu hogar?</h1>
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
                      <Tag variant={dietaState[option.value] ? 'selected' : 'outline'}>
                        {option.label}
                      </Tag>
                    </button>
                    {isLocked && (
                      <span className="group relative inline-flex">
                        <button
                          type="button"
                          data-testid="dieta_vegetariano_lock_info"
                          aria-label="Por qué Vegetariano está bloqueado"
                          aria-describedby="dieta_vegetariano_lock_tooltip"
                          aria-expanded={vegetarianoLockTooltipOpen}
                          className="flex size-4 items-center justify-center rounded-full border border-tertiary text-caption text-tertiary"
                          onClick={() => setVegetarianoLockTooltipOpen(open => !open)}
                        >
                          i
                        </button>
                        <span
                          id="dieta_vegetariano_lock_tooltip"
                          role="tooltip"
                          className={`absolute top-full left-1/2 z-10 mt-1 w-56 -translate-x-1/2 rounded-md bg-primary px-2 py-1.5 text-caption text-background ${vegetarianoLockTooltipOpen ? '' : 'pointer-events-none opacity-0'} group-hover:opacity-100 group-focus-within:opacity-100`}
                        >
                          Vegano incluye vegetariano — todas las recetas veganas son también vegetarianas.
                        </span>
                      </span>
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
            <Input
              data-testid="alergenos_texto_libre_input"
              type="text"
              value={alergenosTextoLibre}
              onChange={e => setAlergenosTextoLibre(e.target.value)}
              placeholder="¿Algún otro alérgeno?"
              aria-label="Alérgenos — texto libre"
              className="mt-2"
            />

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
            <Input
              data-testid="ingredientes_odiados_texto_libre_input"
              type="text"
              value={ingredientesOdiadosTextoLibre}
              onChange={e => setIngredientesOdiadosTextoLibre(e.target.value)}
              placeholder="¿Algún otro ingrediente que no te guste?"
              aria-label="Ingredientes que no gustan — texto libre"
              className="mt-2"
            />
          </>
        )}

        {step === 3 && (
          <>
            <h1 ref={stepHeadingRef} tabIndex={-1} className="text-h3 outline-none">¿Cuáles son tus cocinas favoritas?</h1>
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
        )}

        {step === 4 && (
          <>
            <h1 ref={stepHeadingRef} tabIndex={-1} className="text-h3 outline-none">¿Quiénes cocináis en casa?</h1>
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

            <label className="mt-4 flex flex-col gap-1">
              <span className="text-body-sm text-tertiary">Presupuesto semanal (estimado)</span>
              <Input
                data-testid="presupuesto_input"
                type="number"
                min={1}
                value={presupuestoSemanaEuros ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  setPresupuestoSemanaEuros(raw === '' ? null : Number(raw));
                }}
                placeholder="Ej. 80"
                className={`max-w-32 ${!presupuestoValid ? 'border-error' : ''}`}
              />
            </label>
            {!presupuestoValid && (
              <p data-testid="presupuesto_validation_message" role="alert" aria-live="polite" className="mt-2 text-body-sm text-error">
                El presupuesto debe ser mayor que 0.
              </p>
            )}

            <h2 className="mt-6 text-h5">¿Qué comidas quieres planificar?</h2>
            <p className="mt-1 text-body-sm text-tertiary">Por defecto planificamos las 3.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MEAL_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  data-testid="meal_option"
                  aria-pressed={planningMeals.includes(option.value)}
                  onClick={() => toggleMeal(option.value)}
                >
                  <Tag variant={planningMeals.includes(option.value) ? 'selected' : 'outline'}>
                    {option.label}
                  </Tag>
                </button>
              ))}
            </div>

            <h2 className="mt-6 text-h5">¿Qué días quieres planificar?</h2>
            <p className="mt-1 text-body-sm text-tertiary">Por defecto planificamos los 7.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DAY_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  data-testid="day_option"
                  aria-pressed={planningDays.includes(option.value)}
                  onClick={() => toggleDay(option.value)}
                >
                  <Tag variant={planningDays.includes(option.value) ? 'selected' : 'outline'}>
                    {option.label}
                  </Tag>
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-3">
              <button type="button" data-testid="select_all_days_button" className="text-caption font-sans text-primary" onClick={selectAllDays}>
                Todos
              </button>
              <button type="button" data-testid="select_no_days_button" className="text-caption font-sans text-tertiary" onClick={selectNoDays}>
                Ninguno
              </button>
            </div>
          </>
        )}

        {generateError && !hasExistingMenu && (
          <div className="mt-4">
            <p data-testid="generate_error_message" role="alert" aria-live="assertive" className="text-body-sm text-error">
              {generateError}
            </p>
          </div>
        )}

        {/* FRESCO-152: when a plan already exists, the error text stays
            informational but the *action* moves into the primary CTA below
            ("Ver mi menú", de-emphasized) instead of also living here as a
            separate link — one action, not two competing ones. */}
        {hasExistingMenu && (
          <p data-testid="generate_error_message" role="status" aria-live="polite" className="mt-4 text-body-sm text-tertiary">
            {generateError}
          </p>
        )}

        {generateSuccess
          ? (
              <p data-testid="generate_success_message" role="status" aria-live="polite" className="mt-4 text-body-sm text-primary">
                Se ha generado tu menú correctamente. Te llevamos a verlo…
              </p>
            )
          : isGenerating && (
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
            onClick={() => setStep((step > 1 ? step - 1 : 1) as 1 | 2 | 3 | 4)}
            disabled={step === 1}
          >
            Atrás
          </Button>
          {step < 4
            ? (
                <Button data-testid="next_button" onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4)}>
                  Siguiente
                </Button>
              )
            // FRESCO-152: once a plan already exists for this week,
            // "Generar mi menú" can't succeed — the primary action becomes
            // a de-emphasized "Ver mi menú" instead of repeating a CTA that
            // structurally cannot work.
            : hasExistingMenu
              ? (
                  <Button
                    data-testid="view_existing_menu_button"
                    variant="ghost"
                    onClick={() => router.push('/menu')}
                  >
                    Ver mi menú
                  </Button>
                )
              : (
                  <Button
                    data-testid="generate_menu_button"
                    variant="action"
                    onClick={() => {
                      void handleGenerate();
                    }}
                    disabled={isGenerating || !household.valid || !presupuestoValid}
                  >
                    {isGenerating
                      ? (
                          <>
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            {generateSuccess ? '¡Menú generado!' : 'Generando menú…'}
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
