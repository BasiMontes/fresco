import type { DiaSemana } from '@/lib/api/types';
import * as React from 'react';

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
export function useVisibleDayWindow(planningDays: DiaSemana[]) {
  const [startIndex, setStartIndex] = React.useState(0);
  // How many day columns fit on screen at once — narrower on mobile so
  // cards stay full-width readable, wider on desktop where there's room.
  // Starts at the mobile default (1) so server and client render the same
  // markup on hydration; the effect below corrects it to the real viewport
  // right after mount.
  const [visibleDayCount, setVisibleDayCount] = React.useState(1);

  React.useEffect(() => {
    const lgQuery = window.matchMedia('(min-width: 1024px)');
    const smQuery = window.matchMedia('(min-width: 640px)');
    const updateVisibleDayCount = () => {
      setVisibleDayCount(lgQuery.matches ? 3 : smQuery.matches ? 2 : 1);
    };
    updateVisibleDayCount();
    lgQuery.addEventListener('change', updateVisibleDayCount);
    smQuery.addEventListener('change', updateVisibleDayCount);
    return () => {
      lgQuery.removeEventListener('change', updateVisibleDayCount);
      smQuery.removeEventListener('change', updateVisibleDayCount);
    };
  }, []);

  const visibleDays = planningDays.slice(startIndex, startIndex + visibleDayCount);
  const canGoPrevDay = startIndex > 0;
  const canGoNextDay = startIndex < planningDays.length - 1;

  return { visibleDays, startIndex, setStartIndex, canGoPrevDay, canGoNextDay };
}
