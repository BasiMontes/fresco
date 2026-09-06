import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Shared "nothing here yet" primitive (icon + message + optional CTA).
 * Styled from `DESIGN.md` tokens — no per-screen mockup.
 *
 * First consumer: `/menu`'s "no plan generated yet" state (STORY-FRESCO-7);
 * also `/calendar`, `/recipes`, `/favorites`, `/shopping-list`,
 * `/notifications`, `/historial`.
 *
 * FRESCO-448 (S1): was rendering on the darker recessed `surface` token with
 * no hairline — the "beige on beige" v1 read that DESIGN.md §Elevation exists
 * to fix. Now matches `Card`: `surface-raised` + unconditional hairline. The
 * title also carried `text-h5` on an `<h2>`, which the global rule forced to
 * a bold 15px Fraunces serif ("never bold a Fraunces headline"); `titleAs`
 * lets the consuming page pass `h1` when this state owns the page's only
 * heading, and `text-h4` on a non-`h2` element keeps it Figtree 600.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  /**
   * Heading level for the title — `h1` when the empty state is the page's
   *  only heading, otherwise the default `h2`.
   */
  titleAs?: 'h1' | 'h2'
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, titleAs: TitleTag = 'h2', description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-card border border-border bg-surface-raised p-8 text-center shadow-sm',
        className,
      )}
      {...props}
    >
      {icon}
      <TitleTag className="text-h4">{title}</TitleTag>
      {description && <p className="text-body-sm text-tertiary">{description}</p>}
      {action}
    </div>
  );
}
