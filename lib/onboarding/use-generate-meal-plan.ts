import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EdgeFunctionError, generateMealPlan } from '@/lib/api/edge-functions';
import { getPlanTierForAnalytics, upsertUserProfile, UserProfileError } from '@/lib/api/user-profile';
import { getIsoWeek, getIsoWeekMonday } from '@/lib/date/iso-week';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { markFirstMenuGenerated } from '@/lib/push/first-menu-signal';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { createClient } from '@/lib/supabase/client';

// FRESCO-104: distinct from the generic fallback below — a 409 here can
// never be resolved by retrying (the week already has a plan), so it gets
// its own message + a real exit link instead of the generic "intenta de
// nuevo". Same wording as components/calendar/generate-week-button.tsx's
// 409 branch.
const EXISTING_MENU_FOR_WEEK_MESSAGE = 'Ya existe un menú para esta semana.';

export interface UseGenerateMealPlanArgs {
  /** Called right before navigating away on success — flips the funnel tracker's `resetOnUnmount` flag (FRESCO-201). */
  markShouldReset: () => void
}

/**
 * AC-4/FR-1.1 — persists the full onboarding profile, then generates the
 * first meal plan for the current ISO week; narrows every observed failure
 * mode into its own user-facing message. Extracted from
 * `app/onboarding/page.tsx` (A5-M1, god-component split) — no behavior
 * change from the original inline `handleGenerate`.
 */
export function useGenerateMealPlan({ markShouldReset }: UseGenerateMealPlanArgs) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const hasExistingMenu = generateError === EXISTING_MENU_FOR_WEEK_MESSAGE;

  const {
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
    ingredientesOdiadosTextoLibre,
    cocinasTextoLibre,
    presupuestoSemanaEuros,
    planningSelection,
    nivelExperiencia,
  } = useOnboardingStore();

  async function handleGenerate() {
    setIsGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(false);
    // FRESCO-366: the wizard's last step is done and she committed to
    // generating — the `onboarding` funnel step between signup and first menu.
    captureEvent(POSTHOG_EVENTS.ONBOARDING_COMPLETED, { total_steps: 3 });
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
      // FRESCO-366: `semana_iso` + `tier` let the funnel/retention reports
      // slice "primer menú generado" by week and by plan.
      const tier = session?.user?.id
        ? await getPlanTierForAnalytics(client, session.user.id)
        : 'free';
      captureEvent(POSTHOG_EVENTS.MENU_GENERATION_COMPLETED, { semana_iso: semanaIso, tier });
      // FRESCO-152: brief explicit confirmation before leaving — the
      // redirect used to fire immediately with no acknowledgment that
      // the generation actually succeeded.
      setGenerateSuccess(true);
      await new Promise(resolve => setTimeout(resolve, 900));
      // FRESCO-94: the store now persists to sessionStorage so a mid-wizard
      // reload survives — reset so a later same-tab visit to /onboarding
      // doesn't resurface this run's stale answers (deferred to unmount,
      // see the funnel-tracking hook — FRESCO-201).
      markShouldReset();
      // FRESCO-372 (A4-H15): mark the moment of value for PushPromptBanner —
      // the FIRST menu, generated seconds ago, not a settings toggle buried
      // in /profile.
      markFirstMenuGenerated();
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

  return { isGenerating, generateSuccess, generateError, hasExistingMenu, handleGenerate };
}
