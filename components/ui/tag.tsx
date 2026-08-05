import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Tag/pill variants mirror DESIGN.md's `components.tag*` tokens exactly.
 * FRESCO-78 — `accent` moved from `accent-100` to `accent-200`: the text
 * itself had plenty of contrast against `accent-100`, but that background
 * was too close in lightness to `bg-surface` (the card behind it) for the
 * pill shape to read as a distinct chip, not a legibility failure so much
 * as a "the tag disappears into the card" one.
 */
const tagVariants = cva(
  'inline-flex items-center rounded-full px-2 py-1 text-caption font-sans',
  {
    variants: {
      variant: {
        'selected': 'bg-primary text-background',
        'outline': 'border border-primary text-primary',
        'accent': 'bg-accent-200 text-accent-800',
        'accent-2': 'bg-accent-2-100 text-accent-2-800',
        'neutral': 'bg-neutral-100 text-neutral-800',
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
