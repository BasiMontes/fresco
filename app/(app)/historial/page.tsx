import { ArrowLeft, History } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GenerateWeekButton } from '@/components/calendar/generate-week-button';
import { MenuReadonlyGrid } from '@/components/historial/menu-readonly-grid';
import { ReuseMenuButton } from '@/components/historial/reuse-menu-button';
import { WeekHistoryList } from '@/components/historial/week-history-list';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getMealPlanForWeek, listPastMealPlanWeeks } from '@/lib/api/meal-plan';
import { formatWeekRangeLabel, getDateFromIsoWeek, getIsoWeek, getIsoWeekMonday } from '@/lib/date/iso-week';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/;

/**
 * `/historial` — "Histórico de menús" (FRESCO-425). Two views on one route,
 * matching `/calendar`'s `?semana=` convention:
 *
 * - No `?semana` → the list of past weeks (`WeekHistoryList`), or an empty
 *   state when the household has no prior weeks.
 * - `?semana=YYYY-Www` → that week's menu, read-only (`MenuReadonlyGrid`).
 *   A missing / current / future / malformed week redirects back to the
 *   list rather than rendering a broken detail page — the history only ever
 *   holds weeks strictly before the current one.
 *
 * `/calendar`'s `WeekNavigation` is bounded to ±2 weeks (FRESCO-158), so
 * this page is the only way to reach an older menu.
 */
export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const requestedSemana = (await searchParams).semana;

  // ---- Detail view: one past week, read-only ----
  if (requestedSemana) {
    if (!ISO_WEEK_PATTERN.test(requestedSemana)) {
      redirect('/historial');
    }

    const requestedMondayMs = new Date(`${getDateFromIsoWeek(requestedSemana).toISOString().slice(0, 10)}T00:00:00.000Z`).getTime();
    const currentMondayMs = new Date(`${getIsoWeekMonday()}T00:00:00.000Z`).getTime();
    if (requestedMondayMs >= currentMondayMs) {
      redirect('/historial');
    }

    const [plan, currentWeekPlan] = await Promise.all([
      getMealPlanForWeek(supabase, requestedSemana, user?.id).catch((error) => {
        console.error('[/historial] getMealPlanForWeek failed', error);
        return null;
      }),
      // Only to decide whether "Usar este menú" needs the replace confirmation.
      getMealPlanForWeek(supabase, getIsoWeek(), user?.id).catch((error) => {
        console.error('[/historial] current-week read failed, assuming no menu', error);
        return null;
      }),
    ]);

    if (!plan) {
      redirect('/historial');
    }

    const mondayIso = getDateFromIsoWeek(requestedSemana).toISOString().slice(0, 10);

    return (
      <div className="mx-auto max-w-5xl">
        {/* FRESCO-451: standardized on the icon-only circular back button
            used by favorites/notifications — this used to be a text+icon
            inline link, a third, inconsistent back-affordance pattern. */}
        <div className="flex items-center gap-3">
          <Link
            href="/historial"
            data-testid="historial_back_link"
            aria-label="Volver al histórico"
            className={cn(buttonVariants({ variant: 'icon', size: 'sm' }), 'shrink-0')}
          >
            <ArrowLeft className="size-6" aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-h2">
              Semana del
              {' '}
              {formatWeekRangeLabel(mondayIso)}
            </h1>
            <p className="text-h6 uppercase text-tertiary">Solo lectura</p>
          </div>
        </div>
        <p className="mt-1 text-body-md text-tertiary">
          Menú de solo lectura. Puedes copiarlo a la semana en curso.
        </p>
        <div className="mt-4">
          <ReuseMenuButton
            sourceMealPlanId={plan.mealPlanId}
            currentWeekHasMenu={currentWeekPlan !== null}
          />
        </div>
        <div className="mt-6">
          <MenuReadonlyGrid menu={plan.menu} estados={plan.estados} />
        </div>
      </div>
    );
  }

  // ---- List view: every past week ----
  const weeks = await listPastMealPlanWeeks(supabase, user?.id).catch((error) => {
    console.error('[/historial] listPastMealPlanWeeks failed, showing empty state', error);
    return [];
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h2">Histórico de menús</h1>
      <p className="text-h6 uppercase text-tertiary">Semanas anteriores</p>
      <p className="mt-1 text-body-md text-tertiary">
        Tus menús de semanas anteriores, con lo que marcaste como cocinado o descartado.
      </p>

      <div className="mt-6">
        {weeks.length === 0
          ? (
              <EmptyState
                data-testid="historial_empty_state"
                icon={<History className="size-8 text-tertiary" aria-hidden="true" />}
                title="Todavía no tienes menús anteriores"
                description="Cuando planifiques y pase la semana, tus menús aparecerán aquí."
                action={<GenerateWeekButton semanaIso={getIsoWeek()} fechaInicio={getIsoWeekMonday()} />}
              />
            )
          : (
              <WeekHistoryList weeks={weeks} />
            )}
      </div>
    </div>
  );
}
