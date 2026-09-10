'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * FRESCO-482 — a 2px bar at the top of the viewport that sweeps on every
 * client navigation, so a route change never looks like "nothing happened".
 *
 * Mechanism: `usePathname()` / `useSearchParams()` change once a navigation
 * commits. Each commit bumps a key; the keyed element re-mounts and its CSS
 * animation (`.top-progress-bar` in `app/globals.css`) replays once — a
 * quick fill-and-fade. Slow transitions are additionally covered by the
 * route `loading.tsx` skeletons and, on the auth flow, by
 * `AuthTransitionOverlay`; this bar is the lightweight "it moved" signal for
 * the fast ones.
 *
 * `prefers-reduced-motion` is handled entirely in CSS (a `reduce` block that
 * drops the sweep to a brief opacity blip), matching how `.page-transition`
 * and the transitions-dev animations do it. `aria-hidden` — it is decoration,
 * not status; screen-reader users get the real `loading.tsx` fallbacks.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [key, setKey] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    // Skip the initial mount — nothing navigated, so nothing to signal.
    if (first.current) {
      first.current = false;
      return;
    }
    setKey(k => k + 1);
  }, [pathname, searchParams]);

  if (key === 0) {
    return null;
  }

  return (
    <div
      key={key}
      className="top-progress-bar"
      aria-hidden="true"
      data-testid="top_progress_bar"
    />
  );
}
