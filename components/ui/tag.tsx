import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Tag/pill variants mirror DESIGN.md v2's `components.tag*` tokens.
 *
 * FRESCO-439 (DESIGN.md v2): tags are hairline by default — no colour fill.
 * `accent` and `neutral` (previously tinted `accent-200` / `neutral-100`
 * fills) now render as the same hairline chip; they're kept as names so the
 * ~6 callers don't churn, but visually there is one non-interactive tag.
 * `allergen` is the ONE tag that keeps a colour fill — allergen and
 * hard-restriction flags must stand out for food-safety reasons.
 * `selected` / `outline` are the interactive filter-chip pair (onboarding,
 * preferences) and keep their primary treatment.
 */
const tagVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-1 text-caption font-sans',
  {
    variants: {
      variant: {
        'selected': 'border-primary bg-primary text-background',
        'outline': 'border-primary text-primary',
        // hairline, no fill — the v2 default
        'neutral': 'border-border text-tertiary',
        'accent': 'border-border text-tertiary',
        // food-safety flag — the only coloured tag in v2
        'allergen': 'border-transparent bg-accent-2-100 text-accent-2-800',
        /** @deprecated FRESCO-439 — use `allergen` */
        'accent-2': 'border-transparent bg-accent-2-100 text-accent-2-800',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface TagProps
  extends React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof tagVariants> {}

export function Tag({ className, variant, ...props }: TagProps) {
  return <span className={cn(tagVariants({ variant, className }))} {...props} />;
}
