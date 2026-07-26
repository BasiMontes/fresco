'use client';

import { BookOpen, Calendar, Home, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Mobile navigation — mirrors DESIGN.md's `components.nav-bottom-tab` token:
 * `background`-colored background, `primary`-colored icons, dot-indicator
 * active state (rather than a pill/background fill — DESIGN.md: "kept
 * lighter-weight than the sidebar because mobile chrome competes for less
 * space"). Same 4 destinations as the sidebar.
 */
const NAV_ITEMS = [
  { href: '/menu', label: 'Menú', icon: Home },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/recipes', label: 'Recetas', icon: BookOpen },
  { href: '/profile', label: 'Perfil', icon: User },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[100] flex border-t border-border bg-background md:hidden">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-1 py-2 text-caption text-primary"
          >
            <Icon className="size-[22px]" strokeWidth={2} />
            <span>{label}</span>
            <span
              className={cn('size-1 rounded-full', isActive ? 'bg-primary' : 'bg-transparent')}
            />
          </Link>
        );
      })}
    </nav>
  );
}
