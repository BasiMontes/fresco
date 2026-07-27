import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Shared "nothing here yet" primitive (icon + message + optional CTA).
 * No per-screen mockup exists for this state (DESIGN.md-only fidelity, per
 * `.context/design/master-design-plan.md` not existing yet) — styled from
 * existing `Card`/typography tokens rather than inventing new markup.
 *
 * First consumer: `/menu`'s "no plan generated yet" state (STORY-FRESCO-7).
 * Written as a shared component (not inlined in that page) so `/calendar`'s
 * equivalent empty state — separate wiring work — can reuse it without a
 * second implementation.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-card bg-surface p-8 text-center shadow-sm',
        className,
      )}
      {...props}
    >
      {icon}
      <h2 className="text-h5">{title}</h2>
      {description && <p className="text-body-sm text-tertiary">{description}</p>}
      {action}
    </div>
  );
}
