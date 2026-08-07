'use client';

import type { AccountUser } from '@/components/layout/sidebar-account';
import { BookOpen, Calendar, Home, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { usePathname } from 'next/navigation';
import { SidebarAccount } from '@/components/layout/sidebar-account';
import { cn } from '@/lib/utils';

/**
 * Desktop navigation — mirrors DESIGN.md's `components.nav-sidebar` token:
 * `primary` (`#0F4E0E`, "verde corporativo") background, active item
 * highlighted with a filled pill in background/cream. FRESCO-70 — changed
 * from the dark `accent-900` end of the ramp to the primary brand green
 * itself; white/cream logo and text still clear WCAG AA (~9.9:1) against
 * it. Uses `Logo negativo`, never the base logo, per DESIGN.md's Do's list.
 */
const NAV_ITEMS = [
  { href: '/menu', label: 'Menú', icon: Home },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/recipes', label: 'Recetas', icon: BookOpen },
  { href: '/profile', label: 'Perfil', icon: User },
] as const;

export interface SidebarProps {
  /**
   * Signed-in user's account info (FRESCO-82), rendered in the sidebar
   * footer — `null` when there is no active session, in which case
   * `SidebarAccount` is not mounted at all (AC scenario 3).
   */
  user: AccountUser | null
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-primary px-4 py-6 text-background md:flex">
      <Link href="/menu" className="mb-8 flex items-center px-2">
        <Image src="/brand/logo-negativo.svg" alt="Fresco" width={112} height={34} priority />
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-full px-4 py-2 text-label font-sans transition-colors',
                isActive
                  ? 'bg-background text-primary'
                  : 'text-background/80 hover:bg-background/10',
              )}
            >
              <Icon className="size-[22px]" strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>
      {user && <SidebarAccount nombre={user.nombre} email={user.email} plan={user.plan} isAnonymous={user.isAnonymous} />}
    </aside>
  );
}
