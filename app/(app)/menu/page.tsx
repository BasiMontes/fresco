import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import { Zap } from 'lucide-react';

import Link from 'next/link';
import { NoMenuEmptyState } from '@/components/menu/no-menu-empty-state';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { AlertBanner } from '@/components/ui/alert-banner';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getMealPlanForWeek } from '@/lib/api/meal-plan';
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
  let plan: MenuSemanalPersistido | null;
  try {
    plan = await getMealPlanForWeek(supabase);
  }
  catch (error) {
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
    plan = null;
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-3xl">
        <NoMenuEmptyState data-testid="menu_empty_state" />
      </div>
    );
  }

  const hoy = plan.menu.lunes;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h2">Hoy</h1>
      <p className="mt-1 text-body-md text-tertiary">Tu menú de lunes, listo.</p>

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

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(['desayuno', 'comida', 'cena'] as const).map(slot => (
          <div key={slot}>
            <p className="mb-2 text-h6 uppercase text-tertiary">{slot}</p>
            {hoy[slot]
              ? <RecipeCard recipe={hoy[slot]} />
              : (
                  // FR-8.2 / AC Scenario 4 (FRESCO-23): no safe recipe for
                  // this slot — `AlertBanner` above already surfaces why.
                  <Card data-testid={`menu_slot_${slot}_sin_receta`}>
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
    </div>
  );
}
