import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import type { DiaSemana } from '@/lib/api/types';

import { GripVertical } from 'lucide-react';
import { NoMenuEmptyState } from '@/components/menu/no-menu-empty-state';
import { AlertBanner } from '@/components/ui/alert-banner';
import { getMealPlanForWeek } from '@/lib/api/meal-plan';
import { createClient } from '@/lib/supabase/server';

/**
 * `/calendar` — EPIC-FRESCO-3 (Editable Calendar, US 3.1/3.2). Full 7x3
 * weekly grid. Structural shell only: drag & drop reordering is deferred to
 * `/sprint-development` story work (needs a real drag library + persisted
 * state), the 6-dot handle icon from DESIGN.md's icon set is shown as a
 * static affordance for now.
 *
 * Reads the real, persisted current-week menu (STORY-FRESCO-7) via
 * `getMealPlanForWeek()` instead of `buildMockWeeklyMenu()` — an `async`
 * Server Component, same three-state pattern already established by
 * `/menu`'s page (empty / plan-with-`advertencias` / happy path), reusing
 * the exact same read function so both pages stay in sync with the same
 * persisted week.
 */

const DIA_LABELS: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

const SLOTS = ['desayuno', 'comida', 'cena'] as const;

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

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h2">Calendario semanal</h1>
      <p className="mt-1 text-body-md text-tertiary">Arrastra cualquier plato para reorganizar tu semana.</p>

      <AlertBanner
        advertencias={plan.advertencias}
        data-testid="calendar_advertencias_banner"
        className="mt-4"
      />

      <div className="mt-6 overflow-x-auto">
        <div className="grid min-w-[840px] grid-cols-7 gap-3">
          {(Object.keys(DIA_LABELS) as DiaSemana[]).map(dia => (
            <div key={dia} className="flex flex-col gap-3">
              <p className="text-label">{DIA_LABELS[dia]}</p>
              {SLOTS.map((slot) => {
                const recipe = plan.menu[dia][slot];
                return (
                  <div
                    key={slot}
                    className="flex items-start gap-2 rounded-card bg-surface p-3 shadow-sm"
                  >
                    <GripVertical className="mt-0.5 size-4 shrink-0 text-tertiary" />
                    <div>
                      <p className="text-caption uppercase text-tertiary">{slot}</p>
                      <p className="text-body-sm">{recipe.nombre}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
