'use client';

import { BookOpen, Calendar, Home, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Desktop navigation — mirrors DESIGN.md's `components.nav-sidebar` token:
 * dark `accent-900` background, active item highlighted with a filled pill
 * in background/cream. Per DESIGN.md ("the one place in the system where
 * the dark end of the accent ramp becomes a surface color"), this is the
 * only surface in the app that uses the dark accent-900 background — never
 * reuse it elsewhere. Uses `Logo negativo`, never the base logo, per
 * DESIGN.md's Do's list.
 */
const NAV_ITEMS = [
  { href: '/menu', label: 'Menú', icon: Home },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/recipes', label: 'Recetas', icon: BookOpen },
  { href: '/profile', label: 'Perfil', icon: User },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-accent-900 px-4 py-6 text-background md:flex">
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
              className={cn(
                'flex items-center gap-3 rounded-full px-4 py-2 text-label font-sans transition-colors',
                isActive
                  ? 'bg-background text-accent-900'
                  : 'text-background/80 hover:bg-background/10',
              )}
            >
              <Icon className="size-[22px]" strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
