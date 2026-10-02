import type { DiaSemana } from '@/lib/api/types';
import * as React from 'react';

/** Day columns are fixed at 15rem in `calendar-grid.tsx`, with a 0.75rem (`gap-3`) gap. */
const DAY_COLUMN_PX = 240;
const GRID_GAP_PX = 12;
/** Widest meal-type label ("DESAYUNO", measured ~77px) plus headroom. */
const LABEL_COLUMN_PX = 88;
const MAX_VISIBLE_DAYS = 3;

/**
 * How many whole day columns fit next to the meal-type label column in a
 * container `containerWidth` px wide. Always at least 1 (a single column is
 * the floor, even if it has to be tight), never more than 3.
 */
export function visibleDayCountFor(containerWidth: number): number {
  const fitting = Math.floor((containerWidth - LABEL_COLUMN_PX) / (DAY_COLUMN_PX + GRID_GAP_PX));
  return Math.min(MAX_VISIBLE_DAYS, Math.max(1, fitting));
}

/**
 * FRESCO-271 — replaces the FRESCO-170/FRESCO-222 approach entirely
 * instead of patching it a third time: both prior fixes tried to keep the
 * meal-type label column visually pinned while COUNTER-TRANSLATING it
 * against a continuously-changing `scrollLeft` (first on the `scroll`
 * event, then on every `requestAnimationFrame` when the `scroll` event
 * proved too slow on mobile) — any sync mechanism against a continuously
 * moving scroll position has more edge cases to reopen the same "se
 * mueve" symptom (a new input path, a faster device, a drag-triggered
 * auto-scroll). Removing the continuous scroll removes the entire class
 * of bug: the grid no longer scrolls at all. Only `startIndex` (which day
 * the visible window starts at) changes, and only on a discrete arrow
 * click — the label column is simply never inside anything that moves.
 *
 * Extracted from `CalendarGrid` (A5-M1, god-component split) — no
 * behavior change from the original inline implementation.
 */
export function useVisibleDayWindow(
  planningDays: DiaSemana[],
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const [startIndex, setStartIndex] = React.useState(0);
  // How many day columns fit in the grid's OWN container — not the window.
  // FRESCO-786: sizing off the viewport ignored the app sidebar (256px from
  // 768px up), so at 768px two 15rem columns were asked to fit in 442px and
  // the page grew a horizontal scrollbar. Starts at the mobile default (1)
  // so server and client render the same markup on hydration; the observer
  // below corrects it to the real width right after mount.
  const [visibleDayCount, setVisibleDayCount] = React.useState(1);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') { return; }
    const update = () => setVisibleDayCount(visibleDayCountFor(container.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  const visibleDays = planningDays.slice(startIndex, startIndex + visibleDayCount);
  const canGoPrevDay = startIndex > 0;
  const canGoNextDay = startIndex < planningDays.length - 1;

  return { visibleDays, startIndex, setStartIndex, canGoPrevDay, canGoNextDay };
}
