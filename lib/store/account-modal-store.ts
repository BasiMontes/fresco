import { create } from 'zustand';

/** The `/profile` modals the account menu can open directly (FRESCO-1074). */
export type AccountModal = 'configuracion' | 'faq';

interface AccountModalState {
  /** Set by the account menu, consumed (and cleared) by the profile's `AyudaSection`. */
  requested: AccountModal | null
  request: (modal: AccountModal) => void
  clear: () => void
}

/**
 * FRESCO-1074: a request from the account menu to open a `/profile` modal. A store rather than a
 * URL hash because Next's `Link` changes a hash with `pushState`, which fires no `hashchange`:
 * clicking the menu item while already on `/profile` would do nothing. The request also survives
 * the navigation, so the same call works from any other page.
 */
export const useAccountModalStore = create<AccountModalState>(set => ({
  requested: null,
  request: modal => set({ requested: modal }),
  clear: () => set({ requested: null }),
}));
