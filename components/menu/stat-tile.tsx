import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';

export interface StatTileProps {
  'icon': LucideIcon
  'value': ReactNode
  'label': string
  /** When given, the whole tile becomes a tap target linking here. */
  'href'?: string
  'data-testid'?: string
}

/**
 * FRESCO-444 — value-indicator tile for `/menu`'s stat strip. A top hairline
 * (`border-t border-border` + `pt-3`), not the `Card` surface: no fill, no
 * shadow, no rounding, no full border. The number (`text-h2`) is the dominant
 * element; the icon is demoted to `text-tertiary` (one-accent-per-screen,
 * FRESCO-440). The strip reads as one unit divided by hairlines, per
 * DESIGN.md §Layout.
 */
export function StatTile({ icon: Icon, value, label, href, 'data-testid': testId }: StatTileProps) {
  const content = (
    <>
      <Icon className="size-4 text-tertiary" aria-hidden="true" />
      <p className="text-h2">{value}</p>
      <p className="text-body-sm text-tertiary">{label}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} data-testid={testId} className="block border-t border-border pt-3">
        {content}
      </Link>
    );
  }

  return (
    <div data-testid={testId} className="border-t border-border pt-3">
      {content}
    </div>
  );
}
