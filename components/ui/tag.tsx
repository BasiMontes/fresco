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
  // FRESCO-451: `whitespace-nowrap` at the component level, not bolted onto
  // individual call sites — a pill's text wrapping inside its own rounded
  // border (found live on /profile's plan Tag at 320px) is a defect for
  // every caller, not a per-instance choice.
  'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-1 text-caption font-sans',
  {
    variants: {
      variant: {
        'selected': 'border-primary bg-primary text-on-brand',
        'outline': 'border-primary text-primary',
        // hairline, no fill — the v2 default
        'neutral': 'border-border text-tertiary',
        'accent': 'border-border text-tertiary',
        // food-safety flag — the only coloured tag in v2. FRESCO-448 (S6b):
        // the amber-100 fill has ~0 contrast on the cream page, so the tag
        // that "must stand out for food-safety" was the least visible one.
        // A `accent-2-600` boundary clears ~3.5:1 on `background` wherever the
        // tag sits directly on the page (recipe detail), and both ends of the
        // pair flip correctly in §Dark mode.
        'allergen': 'border-accent-2-600 bg-accent-2-100 text-accent-2-800',
        /** @deprecated FRESCO-439 — use `allergen` */
        'accent-2': 'border-accent-2-600 bg-accent-2-100 text-accent-2-800',
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
