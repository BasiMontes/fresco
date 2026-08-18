'use client';

import { BookOpen, Calendar, Home, ShoppingCart, User } from 'lucide-react';
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
  // FRESCO-164 — /shopping-list (STORY-FRESCO-13) was fully built and
  // working, just unreachable: no nav item linked to it anywhere.
  { href: '/shopping-list', label: 'Lista', icon: ShoppingCart },
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
            aria-current={isActive ? 'page' : undefined}
            className="relative flex flex-1 flex-col items-center gap-0.5 py-1 text-caption text-primary"
          >
            <Icon className="size-5" strokeWidth={2} />
            <span>{label}</span>
            <span
              className={cn(
                'absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full',
                isActive ? 'bg-primary' : 'bg-transparent',
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
