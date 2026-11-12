import { create } from 'zustand';

interface TourState {
  /** Set by the Configuración row, consumed (and cleared) by the first-visit tour mounted in the layout. */
  replayRequested: boolean
  requestReplay: () => void
  clear: () => void
}

/**
 * FRESCO-1197: a request to start the first-visit tour again. A store rather than a prop because the
 * Configuración row (in `/profile`) and the tour (in the authenticated layout) live in different parts
 * of the tree, and the request must survive the navigation to `/menu`. Same pattern as
 * `useAccountModalStore` (FRESCO-1074).
 */
export const useTourStore = create<TourState>(set => ({
  replayRequested: false,
  requestReplay: () => set({ replayRequested: true }),
  clear: () => set({ replayRequested: false }),
}));
