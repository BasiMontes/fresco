import type { PastMealPlanWeek } from '@/lib/api/meal-plan';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatWeekRangeLabel } from '@/lib/date/iso-week';

/**
 * FRESCO-427 — the "Histórico de menús" summary on `/profile`, after the
 * "Preferencias" card. The cocinada/descartada balance per week is the
 * at-a-glance proof that Fresco keeps a record of what the household
 * actually cooked — the same signal the Pro learning reads back. For a Free
 * plan the card adds one line of Pro context; it never gates anything.
 */
export function MenuHistoryCard({ weeks, plan }: {
  weeks: PastMealPlanWeek[]
  plan: 'free' | 'pro' | 'family'
}) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Histórico de menús</CardTitle>
      </CardHeader>
      <CardContent>
        {weeks.length === 0
          ? (
              <p className="text-body-sm text-tertiary" data-testid="menu_history_card_empty">
                Aquí verás tus menús cuando planifiques tu primera semana.
              </p>
            )
          : (
              <div className="flex flex-col gap-3">
                <p className="text-body-sm text-tertiary">
                  {weeks.length}
                  {' '}
                  {weeks.length === 1 ? 'semana planificada' : 'semanas planificadas'}
                </p>
                <ul className="flex flex-col gap-1.5" data-testid="menu_history_card_weeks">
                  {weeks.slice(0, 3).map(week => (
                    <li key={week.mealPlanId} className="flex items-baseline justify-between gap-3 text-body-sm">
                      <span className="text-text">
                        Semana del
                        {' '}
                        {formatWeekRangeLabel(week.mondayIso)}
                      </span>
                      <span className="shrink-0 text-caption text-tertiary">
                        {week.cocinadas}
                        {' cocinadas · '}
                        {week.descartadas}
                        {' descartadas'}
                      </span>
                    </li>
                  ))}
                </ul>
                {plan === 'free' && (
                  <p className="text-caption text-tertiary" data-testid="menu_history_card_pro_hint">
                    Con Fresco Pro, cada menú aprende de lo que cocinaste la semana anterior.
                  </p>
                )}
                <Link
                  href="/historial"
                  data-testid="menu_history_card_link"
                  className="inline-flex items-center gap-1 text-body-sm text-primary hover:underline"
                >
                  Ver histórico completo
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            )}
      </CardContent>
    </Card>
  );
}
