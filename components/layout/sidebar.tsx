'use client';

import type { AccountUser } from '@/components/layout/sidebar-account';
import { BookOpen, Calendar, Home, PanelLeftClose, PanelLeftOpen, ShoppingCart, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { SidebarAccount } from '@/components/layout/sidebar-account';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { writeSidebarCollapsed } from '@/lib/layout/sidebar-preference';
import { cn } from '@/lib/utils';

/**
 * Desktop navigation — mirrors DESIGN.md's `components.nav-sidebar` token:
 * `primary` (`#0F4E0E`, "verde corporativo") background, active item
 * highlighted with a filled pill in background/cream. FRESCO-70 — changed
 * from the dark `accent-900` end of the ramp to the primary brand green
 * itself; white/cream logo and text still clear WCAG AA (~9.9:1) against
 * it. Uses `Logo negativo`, never the base logo, per DESIGN.md's Do's list.
 *
 * FRESCO-485 — collapsible to a `w-16` icon rail. The preference is a
 * cookie (`lib/layout/sidebar-preference.ts`) read server-side in
 * `app/(app)/layout.tsx` and passed in as `initialCollapsed`, so the rail
 * renders at the right width on the first byte (no flash, no layout shift),
 * exactly like the theme cookie. The width animates with `transition-[width]`
 * and is dropped under `prefers-reduced-motion`.
 */
const NAV_ITEMS = [
  { href: '/menu', label: 'Menú', icon: Home },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/recipes', label: 'Recetas', icon: BookOpen },
  // FRESCO-164 — /shopping-list (STORY-FRESCO-13) was fully built and
  // working, just unreachable: no nav item linked to it anywhere.
  { href: '/shopping-list', label: 'Lista', icon: ShoppingCart },
  { href: '/profile', label: 'Perfil', icon: User },
] as const;

export interface SidebarProps {
  /**
   * Signed-in user's account info (FRESCO-82), rendered in the sidebar
   * footer — `null` when there is no active session, in which case
   * `SidebarAccount` is not mounted at all (AC scenario 3).
   */
  user: AccountUser | null
  /**
   * Server-read collapse preference (FRESCO-485). The client keeps its own
   * state after mount; this only seeds the first render so the rail width
   * is correct before hydration.
   */
  initialCollapsed?: boolean
}

export function Sidebar({ user, initialCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsed(next);
      return next;
    });
  }

  return (
    <aside
      data-brand-ground
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto overflow-x-hidden bg-primary py-6 text-background transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex',
        collapsed ? 'w-16 px-2' : 'w-64 px-4',
      )}
    >
      <div className={cn('mb-8 flex items-center', collapsed ? 'flex-col gap-2' : 'justify-between gap-2')}>
        <Link href="/menu" className="flex items-center px-2">
          {collapsed
            ? <Image src="/brand/logo-mark-negativo.svg" alt="Fresco" width={28} height={28} priority />
            : <Image src="/brand/logo-negativo.svg" alt="Fresco" width={112} height={34} priority />}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          aria-expanded={!collapsed}
          data-testid="sidebar_collapse_toggle"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-background/80 transition-colors hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
        >
          {collapsed
            ? <PanelLeftOpen className="size-5" strokeWidth={2} aria-hidden="true" />
            : <PanelLeftClose className="size-5" strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center rounded-full text-label font-sans transition-colors',
                collapsed ? 'size-11 justify-center' : 'gap-3 px-4 py-2',
                isActive
                  ? 'bg-background text-primary'
                  : 'text-background/80 hover:bg-background/10',
              )}
            >
              <Icon className="size-[22px] shrink-0" strokeWidth={2} aria-hidden="true" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <div className={cn('mt-auto flex flex-col gap-4 pt-6', collapsed && 'items-center')}>
        {collapsed
          ? <ThemeToggle tone="inverse" className="flex-col" />
          : (
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-h6 text-background/60">Tema</span>
                <ThemeToggle tone="inverse" />
              </div>
            )}
        {user && (
          <SidebarAccount
            nombre={user.nombre}
            email={user.email}
            plan={user.plan}
            isAnonymous={user.isAnonymous}
            collapsed={collapsed}
          />
        )}
      </div>
    </aside>
  );
}
