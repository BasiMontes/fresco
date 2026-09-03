import { ArrowLeft, History } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GenerateWeekButton } from '@/components/calendar/generate-week-button';
import { MenuReadonlyGrid } from '@/components/historial/menu-readonly-grid';
import { WeekHistoryList } from '@/components/historial/week-history-list';
import { EmptyState } from '@/components/ui/empty-state';
import { getMealPlanForWeek, listPastMealPlanWeeks } from '@/lib/api/meal-plan';
import { formatWeekRangeLabel, getDateFromIsoWeek, getIsoWeek, getIsoWeekMonday } from '@/lib/date/iso-week';
import { createClient } from '@/lib/supabase/server';

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

    const plan = await getMealPlanForWeek(supabase, requestedSemana, user?.id).catch((error) => {
      console.error('[/historial] getMealPlanForWeek failed', error);
      return null;
    });

    if (!plan) {
      redirect('/historial');
    }

    const mondayIso = getDateFromIsoWeek(requestedSemana).toISOString().slice(0, 10);

    return (
      <div className="mx-auto max-w-5xl">
        <Link
          href="/historial"
          data-testid="historial_back_link"
          className="inline-flex items-center gap-1 text-body-sm text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al histórico
        </Link>
        <h1 className="mt-3 text-h2">
          Semana del
          {' '}
          {formatWeekRangeLabel(mondayIso)}
        </h1>
        <p className="mt-1 text-body-md text-tertiary">
          Este menú es de solo lectura. Para volver a usarlo, ábrelo desde el calendario de esa semana.
        </p>
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
