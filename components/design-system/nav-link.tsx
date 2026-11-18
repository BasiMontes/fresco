'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** FRESCO-1229: a sidebar link that knows whether it points at the page being shown (`aria-current="page"`). */
export function NavLink({ href, label, className }: { href: string, label: string, className?: string }) {
  const pathname = usePathname();
  return (
    <Link href={href} aria-current={pathname === href ? 'page' : undefined} className={className}>
      {label}
    </Link>
  );
}
