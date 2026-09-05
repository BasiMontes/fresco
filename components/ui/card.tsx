import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Card variants mirror DESIGN.md's `components.card`, `card-insight`, and
 * `card-pro` tokens. `card` radius is 20px (FRESCO-439, DESIGN.md v2 — down
 * from 32px), not the raw `lg` token — see DESIGN.md Shapes / Do's & Don'ts.
 *
 * FRESCO-439 (DESIGN.md v2): `default` now sits on `surface-raised` (one step
 * LIGHTER than the page) with an unconditional hairline `border-border`, so a
 * card is always visibly distinct from the cream page — the v1 `bg-surface`
 * (one step darker) read as "beige on beige". The hairline is the guarantee,
 * the soft `shadow-sm` is secondary.
 *
 * `insight` is meaning-carrying, not decorative (DESIGN.md Don'ts): only use
 * it for a genuine "Fresco learned something" moment (the Pro-tier learning
 * moat, EPIC-FRESCO-5). It keeps its `accent-100` tint — the one place the
 * near-monochrome v2 UI deliberately raises its voice.
 *
 * `danger` is not a DESIGN.md token — no destructive card variant exists
 * there. Added for `/profile`'s "zona de peligro" footer (FRESCO-70) as a
 * minimal extension: same structure as `pro` (2px border + `shadow-md`), just
 * swapping the primary-color border for the `error` token already used
 * app-wide for destructive affordances (e.g. `DeleteWeekButton`'s
 * `text-error` trash icon) — no new color invented.
 */
const cardVariants = cva('rounded-card p-3', {
  variants: {
    variant: {
      default: 'border border-border bg-surface-raised shadow-sm',
      insight: 'bg-accent-100 text-accent-800 shadow-md',
      pro: 'border-2 border-primary bg-surface-raised shadow-md',
      danger: 'border-2 border-error bg-surface-raised shadow-md',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof cardVariants> {}

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant, className }))} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-2 flex flex-col gap-1', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-h5', className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-body-sm text-tertiary', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-3 flex items-center gap-2', className)} {...props} />;
}
