'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * FRESCO-1229 / FRESCO-1231: a sidebar link. No permanent underline (a column of underlined links is
 * noise). At rest it is the muted `tertiary` text; hover underlines it; the page being shown is
 * `primary` and semibold, and says so to assistive tech with `aria-current="page"`. Keyboard focus
 * gets the app-wide `:focus-visible` outline from `globals.css`. `tertiary` on the page background
 * is about 5.6:1 in light and 7:1 in dark, over the 4.5:1 AA floor.
 */
export function NavLink({ href, label }: { href: string, label: string }) {
  const pathname = usePathname();
  // Prefix match on a segment boundary, so a nested page keeps its parent highlighted and `/colors-extra` does not match `/colors`.
  const isCurrent = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={isCurrent ? 'page' : undefined}
      className={cn(
        'text-body-sm underline-offset-4 hover:text-primary hover:underline',
        isCurrent ? 'font-semibold text-primary' : 'text-tertiary',
      )}
    >
      {label}
    </Link>
  );
}
