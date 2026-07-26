import type { ReactNode } from 'react';

import { BottomTabBar } from '@/components/layout/bottom-tab-bar';
import { Sidebar } from '@/components/layout/sidebar';

/**
 * Combines the desktop sidebar and mobile bottom tab bar per DESIGN.md's
 * Navigation section — "one destination set... surfaced two ways". Wraps
 * every authenticated/app-shell route (menu, calendar, recipes, profile,
 * shopping-list).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 px-4 pb-20 pt-6 md:px-8 md:pb-8">{children}</main>
      <BottomTabBar />
    </div>
  );
}
