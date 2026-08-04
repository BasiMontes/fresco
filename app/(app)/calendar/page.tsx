import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';

import { CalendarGrid } from '@/components/calendar/calendar-grid';
import { DeleteWeekButton } from '@/components/calendar/delete-week-button';
import { GenerateWeekButton } from '@/components/calendar/generate-week-button';
import { WeekNavigation } from '@/components/calendar/week-navigation';
import { NoMenuEmptyState } from '@/components/menu/no-menu-empty-state';
import { AlertBanner } from '@/components/ui/alert-banner';
import { getMealPlanForWeek } from '@/lib/api/meal-plan';
import { getUserPlan } from '@/lib/api/user-profile';
import { getDateFromIsoWeek, getIsoWeek } from '@/lib/date/iso-week';
import { createClient } from '@/lib/supabase/server';

const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/;

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

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // FRESCO-61: `?semana=YYYY-Www` picks which week to view (prev/next
  // controls below). A malformed or absent value falls back to the current
  // week rather than crashing the page — the same page a user reaches by
  // just clicking the nav link in the sidebar has no query param at all.
  const requestedSemana = (await searchParams).semana;
  const semanaIso = requestedSemana && ISO_WEEK_PATTERN.test(requestedSemana)
    ? requestedSemana
    : getIsoWeek();
  const mondayIso = getDateFromIsoWeek(semanaIso).toISOString().slice(0, 10);

  // `plan` and `userPlan` are mutually independent reads — run them
  // concurrently rather than sequentially (this page still awaited each in
  // turn, unlike /menu, /profile, and /recipes, already fixed this session).
  // Both are also passed the already-resolved `user.id`, cutting the
  // redundant internal auth.getUser() round trip each would otherwise make.
  const [plan, userPlan] = await Promise.all([
    getMealPlanForWeek(supabase, semanaIso, user?.id).catch((error) => {
      // Same judgment call as `/menu` (STORY-FRESCO-7 batch 2):
      // `getMealPlanForWeek` fails fast (throws) on a real read error,
      // including "no authenticated session" — a real gap remains only for a
      // visit with literally zero session at all, not for guest vs. registered
      // (ADR-0003, FRESCO-17 resolved that). Falls back to the same empty
      // state rather than crashing the page; a dedicated read-error UI is a
      // tracked gap, not this story's job.
      // Logged so a real DB/network outage stays visible in server logs.
      console.error('[/calendar] getMealPlanForWeek failed, falling back to empty state', error);
      return null as MenuSemanalPersistido | null;
    }),
    // Gates the Free-tier "esto es una función Pro" notice (STORY-FRESCO-15,
    // Business Rules) — a read failure here is not worth crashing the page
    // over, defaults to the more conservative 'free' (shows the notice).
    getUserPlan(supabase, user?.id).catch((error) => {
      console.error('[/calendar] getUserPlan failed, defaulting to free', error);
      return 'free' as 'free' | 'pro' | 'family';
    }),
  ]);

  if (!plan) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-h2">Calendario semanal</h1>
          <WeekNavigation semanaIso={semanaIso} mondayIso={mondayIso} />
        </div>
        <div className="mt-6">
          <NoMenuEmptyState
            data-testid="calendar_empty_state"
            action={<GenerateWeekButton semanaIso={semanaIso} fechaInicio={mondayIso} />}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-h2">Calendario semanal</h1>
        <div className="flex items-center gap-2">
          <WeekNavigation semanaIso={semanaIso} mondayIso={mondayIso} />
          <DeleteWeekButton mealPlanId={plan.mealPlanId} />
        </div>
      </div>
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
