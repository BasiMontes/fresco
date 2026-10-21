'use client';

import type { MarkedDish } from '@/lib/menu/pro-would-have-excluded';
import Link from 'next/link';
import { useEffect } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';

interface ProWouldHaveExcludedNoticeProps {
  /** The dishes of this week's menu that Pro would not have served again. Empty: nothing is painted. */
  dishes: readonly MarkedDish[]
}

/**
 * FRESCO-1027 — shows a Free user what the Pro learning would have changed in this very menu, from the
 * marks they already left: "Con Pro, esta semana no habrías vuelto a ver 2 platos que marcaste en las
 * últimas dos semanas". Read-only: the Free menu is not touched by showing it. Without a matching dish it
 * paints nothing and fires nothing.
 */
export function ProWouldHaveExcludedNotice({ dishes }: ProWouldHaveExcludedNoticeProps) {
  const count = dishes.length;

  useEffect(() => {
    if (count > 0) {
      captureEvent(POSTHOG_EVENTS.PRO_PREVIEW_SHOWN, { platos: count });
    }
  }, [count]);

  if (count === 0) {
    return null;
  }

  return (
    <Card variant="pro" data-testid="pro_preview_notice">
      <CardContent className="flex flex-col gap-3 text-body-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p data-testid="pro_preview_notice_text">
            {`Con Pro, esta semana no habrías vuelto a ver ${count} ${count === 1 ? 'plato que marcaste' : 'platos que marcaste'} en las últimas dos semanas.`}
          </p>
          <p data-testid="pro_preview_notice_dishes" className="mt-1 text-tertiary">
            {dishes.map(dish => dish.nombre).join(', ')}
          </p>
        </div>
        <Link
          href="/profile"
          data-testid="pro_preview_notice_link"
          className={buttonVariants({ variant: 'action' })}
          onClick={() => captureEvent(POSTHOG_EVENTS.PRO_PREVIEW_CLICKED, { platos: count })}
        >
          Ver Pro
        </Link>
      </CardContent>
    </Card>
  );
}
