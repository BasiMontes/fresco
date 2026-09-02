'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * FRESCO-245 — soft transition between the sidebar destinations (Inicio /
 * Calendario / Recetas / Lista / Perfil).
 *
 * `usePathname()` changes on every route navigation, including browser
 * back/forward, so re-keying this wrapper by pathname re-arms the CSS
 * fade-in animation (`.page-transition` in `app/globals.css`) each time the
 * route changes — and only then. In-page state updates (e.g. the calendar
 * drag-and-drop reorder) do not change the pathname, so they are never
 * animated.
 *
 * This is a fade-in of the incoming view, not a true cross-fade of the
 * outgoing + incoming views — the browser View Transitions API path
 * (`experimental.viewTransition`) that would give the full cross-fade
 * destabilised the calendar reorder flow (see the story's §5 divergence
 * note). Opacity only, no transform — no layout shift (CLS ~ 0).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
