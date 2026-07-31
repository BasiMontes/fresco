import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import { Zap } from 'lucide-react';

import Link from 'next/link';
import { NoMenuEmptyState } from '@/components/menu/no-menu-empty-state';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { AlertBanner } from '@/components/ui/alert-banner';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
 * the grid), and the plain happy path.
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
    // including "no authenticated session" — correct for the function
    // itself, but guest/auth flow is unresolved everywhere else in this repo
    // today (see `lib/api/edge-functions.ts`'s TODOs), so an unauthenticated
    // visit is currently the only reachable state. A dedicated read-error UI
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

      <Card variant="insight" className="mt-6">
        <CardHeader>
          <p className="text-h6 uppercase">Fresco aprendió</p>
          <CardTitle>Menos pimentón picante esta semana</CardTitle>
        </CardHeader>
        <CardContent className="text-body-sm">
          Descartaste el curry picante la semana pasada, así que hemos suavizado las especias en
          tus platos con curry.
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(['desayuno', 'comida', 'cena'] as const).map(slot => (
          <div key={slot}>
            <p className="mb-2 text-h6 uppercase text-tertiary">{slot}</p>
            <RecipeCard recipe={hoy[slot]} />
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
