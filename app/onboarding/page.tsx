'use client';

import type { NivelExperienciaCulinaria, ObjetivoUsuario, SexoUsuario, TipoCocina } from '@schemas';
import type { DietaFlag } from '@/lib/store/onboarding-store';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { useEffect, useRef, useState } from 'react';
import { IdentityStep } from '@/components/onboarding/identity-step';
import { PlanningSelectionGrid } from '@/components/onboarding/planning-selection-grid';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dropdown } from '@/components/ui/dropdown';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/tag';
import { EdgeFunctionError, generateMealPlan } from '@/lib/api/edge-functions';
import { upsertUserProfile, UserProfileError } from '@/lib/api/user-profile';
import { ALERGENO_OPTIONS, DIETA_IMPLIED_ALERGENOS, impliedAlergenos, INGREDIENTE_ODIADO_OPTIONS } from '@/lib/constants/dietary-options';
import { getIsoWeek, getIsoWeekMonday } from '@/lib/date/iso-week';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
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

const ALERGENO_LABELS: Record<string, string> = {
  vegano: 'vegano',
  vegetariano: 'vegetariano',
  sinGluten: 'tu dieta sin gluten',
};

/**
 * FRESCO-275 — one message per locked alergeno, naming every active dieta
 * flag that implies it (a chip can be implied by more than one, e.g.
 * "pescado" by both vegano and vegetariano at once).
 */
function alergenoLockMessage(value: string, flags: { vegano: boolean, vegetariano: boolean, sinGluten: boolean }): string {
  const reasons = (Object.keys(flags) as (keyof typeof flags)[])
    .filter(flag => flags[flag] && DIETA_IMPLIED_ALERGENOS[flag].includes(value))
    .map(flag => ALERGENO_LABELS[flag]);
  return `Ya excluido por ${reasons.join(' y ')} — ninguna receta de nuestro catálogo con esa etiqueta lo incluye.`;
}

/** Shared "why is this locked" disclosure — the vegano→vegetariano lock (AC-2) and the FRESCO-275 dieta→alérgeno locks share this same small info-button + tooltip shape. */
function LockInfoTooltip({ message, testIdPrefix }: { message: string, testIdPrefix: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        data-testid={`${testIdPrefix}_lock_info`}
        aria-label="Por qué está bloqueado"
        aria-expanded={open}
        className="flex size-4 items-center justify-center rounded-full border border-tertiary text-caption text-tertiary"
        onClick={() => setOpen(current => !current)}
      >
        i
      </button>
      <span
        role="tooltip"
        className={`absolute top-full left-1/2 z-10 mt-1 w-56 -translate-x-1/2 rounded-md bg-primary px-2 py-1.5 text-caption text-background ${open ? '' : 'pointer-events-none opacity-0'} group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {message}
      </span>
    </span>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const hasExistingMenu = generateError === EXISTING_MENU_FOR_WEEK_MESSAGE;
  // FRESCO-197: `null` = still checking for an existing session, `false` =
  // no session — show the guest-vs-account choice, `true` = resolved
  // (wizard renders). A just-registered user from /signup or a returning
  // guest already carries a persisted Supabase session, so this only ever
  // surfaces the choice to an actual first-time, session-less visitor.
  const [identityResolved, setIdentityResolved] = useState<boolean | null>(null);
  // FRESCO-255: plays the wizard's entrance stagger (logo -> step indicator
  // -> card) once, the first time it mounts (i.e. once identity resolves) —
  // not replayed on every step change, to avoid fighting the existing
  // stepHeadingRef focus-management effect below.
  const [wizardShown, setWizardShown] = useState(false);
  useEffect(() => {
    setWizardShown(true);
  }, []);
  // FRESCO-263: presupuesto went from optional to required — gates the
  // error styling/message so a fresh visitor doesn't see a red "required"
  // field before she's had a chance to type anything. The submit button
  // itself stays disabled while empty regardless of this flag.
  const [presupuestoTouched, setPresupuestoTouched] = useState(false);

  // FRESCO-201: resetting the store synchronously before router.push()
  // re-rendered this still-mounted page at step 1 for the ~1s the /menu
  // navigation took to commit, flashing the wizard back to the start.
  // Deferring the reset to actual unmount (post-navigation) removes the
  // flash while preserving FRESCO-94's intent below.
  const resetOnUnmount = useRef(false);
  useEffect(() => {
    return () => {
      if (resetOnUnmount.current) {
        useOnboardingStore.getState().reset();
      }
    };
  }, []);

  // FRESCO-17/FRESCO-197 (Guest Mode, US 6.1): a first-time visitor reaches
  // this page with no Supabase session at all — she now sees an explicit
  // guest-vs-account choice (`IdentityStep`) instead of a silent anonymous
  // sign-in. A just-registered user arriving from `/signup`, or a returning
  // guest whose anonymous session already persisted, skips straight to the
  // wizard below.
  useEffect(() => {
    async function checkSession() {
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      setIdentityResolved(!!session);
    }
    void checkSession();
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
    planningSelection,
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
    setPlanningSelection,
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
  // FRESCO-263: presupuesto is now required (previously null/unset was
  // valid — the DB's own check constraint still only rejects 0/negative,
  // this is a stricter onboarding-only rule).
  const presupuestoValid = presupuestoSemanaEuros !== null && presupuestoSemanaEuros > 0;
  // FRESCO-165/166 — QA sweep found "Ninguno" (days) left 0 days selected
  // with "Generar mi menú" still enabled: it generated a menu anyway. Worse,
  // deselecting all 3 meals didn't block generation either, and because
  // `upsertUserProfile()` below persists `planning_selection` BEFORE
  // `generateMealPlan()` runs, a user who reached that state and hit
  // a generation failure (e.g. 409 "plan already exists") was left with a
  // permanently-saved empty preference — `/menu` reads today's meals from
  // that (now-corrupted) preference, not from the real stored plan, so it
  // rendered with zero meal cards and no explanation. Blocking submission
  // here prevents the empty-preference profile write from ever happening.
  const hasInvalidPlanning = Object.values(planningSelection).every(meals => meals.length === 0);

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
    captureEvent(POSTHOG_EVENTS.MENU_GENERATION_STARTED);
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
        planning_selection: planningSelection,
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
      // "generados" half of the North-star KPI (ADR-0013) — fired only once
      // generateMealPlan actually resolves OK, not on mere button press.
      captureEvent(POSTHOG_EVENTS.MENU_GENERATION_COMPLETED);
      // FRESCO-152: brief explicit confirmation before leaving — the
      // redirect used to fire immediately with no acknowledgment that
      // the generation actually succeeded.
      setGenerateSuccess(true);
      await new Promise(resolve => setTimeout(resolve, 900));
      // FRESCO-94: the store now persists to sessionStorage so a mid-wizard
      // reload survives — reset so a later same-tab visit to /onboarding
      // doesn't resurface this run's stale answers (deferred to unmount,
      // see resetOnUnmount above — FRESCO-201).
      resetOnUnmount.current = true;
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

  // FRESCO-197: identity not resolved yet (session check in flight) — avoid
  // flashing the guest-vs-account choice at a visitor who actually already
  // has a session.
  if (identityResolved === null) {
    return (
      <div data-testid="onboardingPage" className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-12">
        <Loader2 data-testid="onboarding_identity_loading" className="size-6 animate-spin text-tertiary" aria-hidden="true" />
      </div>
    );
  }

  if (!identityResolved) {
    return (
      <div data-testid="onboardingPage" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
        <IdentityStep onResolved={() => setIdentityResolved(true)} />
      </div>
    );
  }

  return (
    <div data-testid="onboardingPage" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
      <div className={`t-stagger ${wizardShown ? 'is-shown' : ''}`}>
        <Image
          src="/brand/logo-base.svg"
          alt="Fresco"
          width={100}
          height={30}
          priority
          className="t-stagger-line t-stagger-line--1 mx-auto"
        />

        <div className="t-stagger-line t-stagger-line--2 mt-6">
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
        </div>

        <div className="t-stagger-line t-stagger-line--3 mt-6">
          <Card className="p-6 md:p-8">
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
                          <Tag variant={alergenos.includes(option.value) ? 'selected' : 'outline'}>
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
                  <span data-testid="presupuesto_required_hint" className="text-body-sm text-tertiary">* Campo obligatorio</span>
                  <Input
                    data-testid="presupuesto_input"
                    type="number"
                    required
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
                    {presupuestoSemanaEuros === null ? 'El presupuesto es obligatorio.' : 'El presupuesto debe ser mayor que 0.'}
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
                // FRESCO-296: on step 1 "Atrás" is no longer a dead end — it
                // exits the wizard back to the landing page. Steps 2-4 keep
                // walking back through the wizard.
                onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3 | 4) : router.push('/'))}
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
                        disabled={isGenerating || !household.valid || !presupuestoValid || hasInvalidPlanning}
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
      </div>
    </div>
  );
}
