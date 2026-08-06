import type { Recipe } from '@schemas';
import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import { Bell, Heart, Zap } from 'lucide-react';

import Link from 'next/link';
import { AvailableRecipesCard } from '@/components/menu/available-recipes-card';
import { CalendarSuggestionBanner } from '@/components/menu/calendar-suggestion-banner';
import { LatestRecipesSection } from '@/components/menu/latest-recipes-section';
import { NoMenuEmptyState } from '@/components/menu/no-menu-empty-state';
import { SavingsEstimateCards } from '@/components/menu/savings-estimate-cards';
import { FavoriteRecipeCard } from '@/components/recipe/favorite-recipe-card';
import { AlertBanner } from '@/components/ui/alert-banner';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getFavoriteRecipeIds } from '@/lib/api/favorites';
import { getMealPlanForWeek } from '@/lib/api/meal-plan';
import { getAvailableRecipesCount, getLatestAvailableRecipes } from '@/lib/api/recipes';
import { getUserNombre } from '@/lib/api/user-profile';
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
 */
export default async function MenuPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // The four reads below are mutually independent once `user.id` is
  // resolved — run them concurrently rather than paying for 4 sequential
  // round trips. Each keeps its own fallback via `.catch()` (same
  // conservative-default judgment call as before) so one call's rejection
  // can't take the others down with it.
  const [nombre, recetasDisponibles, ultimasRecetas, plan, favoriteIds] = await Promise.all([
    getUserNombre(supabase, user?.id).catch((error) => {
      // Same conservative fallback as every other server-side profile read on
      // this page: a real read failure falls back to `null` (generic
      // "¡Hola!" greeting) rather than crashing the page.
      console.error('[/menu] getUserNombre failed, defaulting to null', error);
      return null;
    }),
    getAvailableRecipesCount(supabase, user?.id).catch((error) => {
      // Same conservative fallback as every other server-side read on this
      // page: a real read failure hides the card rather than crashing the
      // page or showing a misleading "0" (which would read as an empty
      // catalog, not a transient error).
      console.error('[/menu] getAvailableRecipesCount failed, hiding the card', error);
      return null;
    }),
    getLatestAvailableRecipes(supabase, user?.id).catch((error) => {
      // Same fail-soft pattern as the other value-indicator reads on this
      // page: hides the section instead of crashing the page.
      console.error('[/menu] getLatestAvailableRecipes failed, hiding the section', error);
      return [] as Recipe[];
    }),
    getMealPlanForWeek(supabase, undefined, user?.id).catch((error) => {
      // `getMealPlanForWeek` fails fast (throws) on a real read error,
      // including "no authenticated session" — a real gap remains only for a
      // visit with literally zero session at all (no page currently forces one
      // outside `/onboarding`'s mount effect), not for guest vs. registered
      // (ADR-0003, FRESCO-17 resolved that). A dedicated read-error UI
      // (network/auth, distinct from "no plan yet") is real UI/UX-design scope
      // this story named but no AC scenario requires yet — tracked as a gap,
      // not silently dropped: for now this falls back to the same empty state
      // rather than crashing the page. Logged so a real DB/network outage is
      // still visible in server logs instead of looking identical to a benign
      // "haven't generated a menu yet" state.
      console.error('[/menu] getMealPlanForWeek failed, falling back to empty state', error);
      return null as MenuSemanalPersistido | null;
    }),
    getFavoriteRecipeIds(supabase, user?.id).catch((error) => {
      // Same fail-soft pattern as the other reads on this page: a favorites
      // read failure just shows every heart as unfavorited rather than
      // crashing the page.
      console.error('[/menu] getFavoriteRecipeIds failed, defaulting to none favorited', error);
      return new Set<string>();
    }),
  ]);

  if (!plan) {
    return (
      <div className="mx-auto max-w-3xl">
        {/* FRESCO-56: banner shown regardless of plan state, per AC. */}
        <CalendarSuggestionBanner />
        {/* FRESCO-57: profile-based count, independent of having a plan. */}
        {recetasDisponibles !== null && (
          <AvailableRecipesCard count={recetasDisponibles} />
        )}
        <SavingsEstimateCards />
        <LatestRecipesSection recipes={ultimasRecetas} favoriteRecipeIds={favoriteIds} />
        <NoMenuEmptyState data-testid="menu_empty_state" />
      </div>
    );
  }

  const hoy = plan.menu.lunes;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h2">{nombre ? `¡Hola, ${nombre}!` : '¡Hola!'}</h1>
          <p className="mt-1 text-body-md text-tertiary">Tu menú de hoy, listo.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/favorites" className={buttonVariants({ variant: 'icon', size: 'sm' })} aria-label="Favoritos" data-testid="favoritos_button">
            <Heart className="size-[22px]" />
          </Link>
          <Link href="/notifications" className={buttonVariants({ variant: 'icon', size: 'sm' })} aria-label="Notificaciones" data-testid="notificaciones_button">
            <Bell className="size-[22px]" />
          </Link>
        </div>
      </div>

      <CalendarSuggestionBanner />

      {recetasDisponibles !== null && (
        <AvailableRecipesCard count={recetasDisponibles} />
      )}

      <SavingsEstimateCards />

      {user?.is_anonymous && (
        <Card data-testid="guest_save_menu_banner" className="mt-4 border-2 border-primary">
          <CardContent className="flex flex-col items-start gap-3 text-body-sm sm:flex-row sm:items-center sm:justify-between">
            <p>Crea una cuenta para no perder este menú.</p>
            <Link href="/signup" className={buttonVariants({ variant: 'action' })}>
              Guardar mi menú
            </Link>
          </CardContent>
        </Card>
      )}

      <AlertBanner
        advertencias={plan.advertencias}
        data-testid="menu_advertencias_banner"
        className="mt-4"
      />

      {/*
       * STORY-FRESCO-22 (FR-5.5): real data now, not the hardcoded mock
       * FRESCO-21 removed. `explicacionAprendizaje` is populated server-side
       * only for Pro users with real history (generate-meal-plan/index.ts) —
       * its mere presence here is proof that gate already passed, so no
       * client-side `isPro` re-check is needed.
       */}
      {plan.explicacionAprendizaje && (
        <Card variant="insight" className="mt-6" data-testid="learning_explanation_card">
          <CardContent className="text-body-sm">
            {plan.explicacionAprendizaje}
          </CardContent>
        </Card>
      )}

      <h2 className="sr-only">Menú de hoy por comida</h2>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(['desayuno', 'comida', 'cena'] as const).map(slot => (
          <div key={slot} className="flex flex-col">
            <p className="mb-2 text-h6 uppercase text-tertiary">{slot}</p>
            {hoy[slot]
              ? (
                  <Link href={`/recipes/${hoy[slot].id}`} className="flex flex-1">
                    <FavoriteRecipeCard recipe={hoy[slot]} initialIsFavorite={favoriteIds.has(hoy[slot].id)} className="flex-1" />
                  </Link>
                )
              : (
                  // FR-8.2 / AC Scenario 4 (FRESCO-23): no safe recipe for
                  // this slot — `AlertBanner` above already surfaces why.
                  <Card data-testid={`menu_slot_${slot}_sin_receta`} className="flex-1">
                    <CardContent className="text-body-sm italic text-tertiary">
                      Sin receta segura
                    </CardContent>
                  </Card>
                )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <Link href="/calendar" className={buttonVariants({ variant: 'action', size: 'lg' })}>
          <Zap className="size-[18px]" strokeWidth={2} />
          Cocinar ya
        </Link>
      </div>

      <LatestRecipesSection recipes={ultimasRecetas} favoriteRecipeIds={favoriteIds} />
    </div>
  );
}
