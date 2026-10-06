import { AvailableRecipesCard } from '@/components/menu/available-recipes-card';
import { CalendarSuggestionBanner } from '@/components/menu/calendar-suggestion-banner';
import { LatestRecipesSection } from '@/components/menu/latest-recipes-section';
import { MenuHeader } from '@/components/menu/menu-header';
import { MenuNoPlanView } from '@/components/menu/menu-no-plan-view';
import { MenuNotices } from '@/components/menu/menu-notices';
import { MenuTodaysMeals } from '@/components/menu/menu-todays-meals';
import { PushOpenedTracker } from '@/components/menu/push-opened-tracker';
import { PushPromptBanner } from '@/components/menu/push-prompt-banner';
import { SavingsEstimateCards } from '@/components/menu/savings-estimate-cards';
import { getAuthUser } from '@/lib/auth/current-user';
import { getDateFromIsoWeek, getIsoWeek } from '@/lib/date/iso-week';
import { perfilCompraDesde } from '@/lib/grocery/product-compatibility';
import { costeSemanalEstimado } from '@/lib/grocery/weekly-cost';
import { loadMenuPageData } from '@/lib/menu/load-menu-page-data';
import { snapshotWeeklyCost } from '@/lib/menu/snapshot-weekly-cost';
import { formatSpendVsAverage } from '@/lib/menu/spend-vs-average';
import { createClient } from '@/lib/supabase/server';

/**
 * `/menu` (Home) — nav item 1. Today's meals at a glance + the
 * `card-insight` component, DESIGN.md's answer to the Constitution's named
 * risk that "Free-tier users won't perceive the Pro-tier learning moat
 * unless it's made visible" (EPIC-FRESCO-5, US 5.3).
 *
 * Reads the real, persisted current-week menu (STORY-FRESCO-7) via
 * `getMealPlanForWeek()` instead of `buildMockWeeklyMenu()`. An `async`
 * Server Component fetching data directly — no client-side hooks needed for
 * this read, per this Next.js version's docs (AGENTS.md's breaking-changes
 * warning: Server Components may be `async function` and `await` data
 * directly).
 *
 * Three states: no plan yet for this week (`EmptyState`, AC-4-adjacent but
 * distinct — a normal "haven't generated one" state, not a generation
 * failure), a plan with `advertencias` (AC Scenario 5 — `AlertBanner` above
 * the grid), and the plain happy path. `explicacionAprendizaje` (FR-5.5,
 * STORY-FRESCO-22) is a separate, orthogonal signal — Pro + real history
 * only — rendered in its own `card-insight`, never mixed with `advertencias`.
 *
 * FRESCO-809 — reads live in `loadMenuPageData`, the weekly-cost snapshot in
 * `snapshotWeeklyCost`, and each block of markup in `components/menu/menu-*`.
 */
export default async function MenuPage() {
  const supabase = await createClient();
  // FRESCO-483: shares the layout's verified session read (React.cache) —
  // no third round trip to GoTrue for this render.
  const { data: { user } } = await getAuthUser();

  // FRESCO-509: same current-week values `/calendar` already computes for
  // its own `GenerateWeekButton` — needed here too so the empty-state CTA
  // can generate directly instead of falling back to `/onboarding`.
  const semanaIso = getIsoWeek();
  const mondayIso = getDateFromIsoWeek(semanaIso).toISOString().slice(0, 10);

  const { nombre, recetasDisponibles, ultimasRecetas, plan, favoriteIds, dietaryPreferences, hasUnseenNotifications, spendTrend } = await loadMenuPageData(supabase, { userId: user?.id, semanaIso });

  if (!plan) {
    return (
      <MenuNoPlanView
        semanaIso={semanaIso}
        mondayIso={mondayIso}
        recetasDisponibles={recetasDisponibles}
        ultimasRecetas={ultimasRecetas}
        favoriteIds={favoriteIds}
      />
    );
  }

  // FRESCO-340/792: the weekly cost shown in the "Gasto semanal estimado"
  // tile. Same helper the shopping list summary uses, so both screens show
  // one number; `undefined` (calculation failed) hides the tile.
  const costeEstimado = costeSemanalEstimado(plan.menu, {
    numPersonas: dietaryPreferences?.num_personas,
    perfil: perfilCompraDesde(dietaryPreferences),
  });

  snapshotWeeklyCost(supabase, { userId: user?.id, semanaIso, costeEstimado, spendTrend });

  const isAnonymous = user?.is_anonymous ?? false;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PushOpenedTracker />
      <MenuHeader nombre={nombre} hasUnseenNotifications={hasUnseenNotifications} />

      <div className="space-y-4">
        <CalendarSuggestionBanner />
        <PushPromptBanner isGuest={isAnonymous} />
      </div>

      {/* FRESCO-451 (slice 4/5): gap-8 left each StatTile's top hairline
          reading as a disconnected dash instead of "one unit divided by
          hairlines" (stat-tile.tsx's own intent) — gap-4 keeps them close
          enough to cohere. */}
      <div className="grid grid-cols-2 gap-4">
        {recetasDisponibles !== null && (
          <AvailableRecipesCard count={recetasDisponibles} />
        )}
        <SavingsEstimateCards
          costeEstimado={costeEstimado}
          comparison={costeEstimado === undefined ? null : formatSpendVsAverage(costeEstimado, spendTrend)}
        />
      </div>

      <MenuNotices plan={plan} isAnonymous={isAnonymous} />

      <MenuTodaysMeals plan={plan} dietaryPreferences={dietaryPreferences} favoriteIds={favoriteIds} />

      <LatestRecipesSection recipes={ultimasRecetas} favoriteRecipeIds={favoriteIds} />
    </div>
  );
}
