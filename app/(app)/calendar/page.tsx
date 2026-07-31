import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';

import { CalendarGrid } from '@/components/calendar/calendar-grid';
import { NoMenuEmptyState } from '@/components/menu/no-menu-empty-state';
import { AlertBanner } from '@/components/ui/alert-banner';
import { getMealPlanForWeek } from '@/lib/api/meal-plan';
import { getUserPlan } from '@/lib/api/user-profile';
import { createClient } from '@/lib/supabase/server';

/**
 * `/calendar` — EPIC-FRESCO-3 (Editable Calendar, US 3.1/3.2). Full 7x3
 * weekly grid. Drag & drop reordering (STORY-FRESCO-11) is now live via
 * `CalendarGrid`, a `'use client'` island wrapping `@dnd-kit/core`: any slot
 * can be picked up and dropped onto any other, with an optimistic local swap
 * plus a background `swapMealPlanSlots()` persist and revert-on-failure.
 *
 * Reads the real, persisted current-week menu (STORY-FRESCO-7) via
 * `getMealPlanForWeek()` instead of `buildMockWeeklyMenu()` — an `async`
 * Server Component, same three-state pattern already established by
 * `/menu`'s page (empty / plan-with-`advertencias` / happy path), reusing
 * the exact same read function so both pages stay in sync with the same
 * persisted week. `plan.menu` and `plan.slotIds` are passed straight through
 * to `CalendarGrid` — their shapes already match its `MenuGrid` and
 * `slotIds` props exactly, so no reshaping is needed here.
 */

export default async function CalendarPage() {
  const supabase = await createClient();
  let plan: MenuSemanalPersistido | null;
  try {
    plan = await getMealPlanForWeek(supabase);
  }
  catch (error) {
    // Same judgment call as `/menu` (STORY-FRESCO-7 batch 2):
    // `getMealPlanForWeek` fails fast (throws) on a real read error,
    // including "no authenticated session" — correct for the function
    // itself, but guest/auth flow is unresolved everywhere else in this repo
    // today, so an unauthenticated visit is currently the only reachable
    // state. Falls back to the same empty state rather than crashing the
    // page; a dedicated read-error UI is a tracked gap, not this story's job.
    // Logged so a real DB/network outage stays visible in server logs.
    console.error('[/calendar] getMealPlanForWeek failed, falling back to empty state', error);
    plan = null;
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-5xl">
        <NoMenuEmptyState data-testid="calendar_empty_state" />
      </div>
    );
  }

  // Gates the Free-tier "esto es una función Pro" notice (STORY-FRESCO-15,
  // Business Rules) — a read failure here is not worth crashing the page
  // over, defaults to the more conservative 'free' (shows the notice).
  let userPlan: 'free' | 'pro' | 'family' = 'free';
  try {
    userPlan = await getUserPlan(supabase);
  }
  catch (error) {
    console.error('[/calendar] getUserPlan failed, defaulting to free', error);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h2">Calendario semanal</h1>
      <p className="mt-1 text-body-md text-tertiary">Arrastra cualquier plato para reorganizar tu semana.</p>

      <AlertBanner
        advertencias={plan.advertencias}
        data-testid="calendar_advertencias_banner"
        className="mt-4"
      />

      <div className="mt-6">
        <CalendarGrid
          initialMenu={plan.menu}
          slotIds={plan.slotIds}
          initialEstados={plan.estados}
          userPlan={userPlan}
        />
      </div>
    </div>
  );
}
