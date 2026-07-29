import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** Tag/pill variants mirror DESIGN.md's `components.tag*` tokens exactly. */
const tagVariants = cva(
  'inline-flex items-center rounded-full px-2 py-1 text-caption font-sans',
  {
    variants: {
      variant: {
        'selected': 'bg-primary text-background',
        'outline': 'border border-primary text-primary',
        'accent': 'bg-accent-100 text-accent-800',
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
