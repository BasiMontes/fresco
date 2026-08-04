import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Card variants mirror DESIGN.md's `components.card`, `card-insight`, and
 * `card-pro` tokens. All three use the `card` radius (32px = lg x 1.15),
 * not the raw `lg` token — see DESIGN.md Shapes / Do's & Don'ts.
 *
 * `insight` is meaning-carrying, not decorative (DESIGN.md Don'ts): only use
 * it for a genuine "Fresco learned something" moment (the Pro-tier learning
 * moat, EPIC-FRESCO-5).
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
      default: 'bg-surface shadow-sm',
      insight: 'bg-accent-100 text-accent-800 shadow-md',
      pro: 'border-2 border-primary bg-surface shadow-md',
      danger: 'border-2 border-error bg-surface shadow-md',
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
