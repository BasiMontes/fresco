import type { ReactNode } from 'react';

import { BottomTabBar } from '@/components/layout/bottom-tab-bar';
import { Sidebar } from '@/components/layout/sidebar';

export interface AppShellProps {
  children: ReactNode
  /** Signed-in user's account info (FRESCO-82), forwarded to `Sidebar`. */
  user: {
    nombre: string | null
    email: string
  }
}

/**
 * Combines the desktop sidebar and mobile bottom tab bar per DESIGN.md's
 * Navigation section — "one destination set... surfaced two ways". Wraps
 * every authenticated/app-shell route (menu, calendar, recipes, profile,
 * shopping-list).
 */
export function AppShell({ children, user }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={user} />
      {/*
        min-w-0 overrides the flex item default of min-width:auto — without
        it, a wide horizontally-scrolling descendant (e.g. CalendarGrid's
        own overflow-x-auto row) can force THIS flex item to grow past the
        viewport instead of clipping/scrolling internally, dragging the
        whole page (sidebar included, since it's a sibling flex item, not
        fixed-position) into horizontal scroll along with it.
      */}
      <main className="min-w-0 flex-1 px-4 pb-20 pt-6 md:px-8 md:pb-8">{children}</main>
      <BottomTabBar />
    </div>
  );
}
