'use client';

import { BookOpen, Calendar, Home, ShoppingCart, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Mobile navigation (FRESCO-870) — a floating pill detached from the screen
 * edges. Only the current destination expands into a highlighted pill with its
 * label; the other four stay icon-only (their names stay in the DOM, so assistive
 * tech still announces them). The label column animates `0fr` <-> `1fr` instead
 * of measuring widths, so the pill grows where the previous one shrinks. Timing
 * reuses the `--tabs-*` motion tokens and drops under `prefers-reduced-motion`.
 * Departs from DESIGN.md's `nav-bottom-tab` dot indicator, ratified in
 * `.context/design/master-design-plan.md` §5-W. Same 5 destinations as before.
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
    // FRESCO-757: the offset follows the cookie banner's height while it shows, so
    // the bar sits on top of the banner instead of under it (0 once decided). The
    // `max()` keeps a 0.75rem gap above the home indicator on notched phones.
    <nav data-testid="bottom_tab_bar" className="fixed inset-x-4 bottom-[calc(var(--cookie-banner-inset)+max(env(safe-area-inset-bottom),0.75rem))] z-100 flex items-center justify-between rounded-full border border-border bg-surface-raised p-1 shadow-sm transition-[bottom] duration-200 motion-reduce:transition-none md:hidden">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = Boolean(pathname?.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            data-expanded={isActive ? 'true' : 'false'}
            className={cn(
              'flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-primary transition-colors duration-(--tabs-dur) ease-(--tabs-ease) motion-reduce:transition-none',
              isActive && 'bg-primary/15',
            )}
          >
            <Icon className="size-5 shrink-0" strokeWidth={2} />
            <span
              className={cn(
                'grid transition-[grid-template-columns,margin,opacity] duration-(--tabs-dur) ease-(--tabs-ease) motion-reduce:transition-none',
                isActive ? 'ml-2 grid-cols-[1fr] opacity-100' : 'ml-0 grid-cols-[0fr] opacity-0',
              )}
            >
              <span className="overflow-hidden text-caption font-medium whitespace-nowrap">{label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
