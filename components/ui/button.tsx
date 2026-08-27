import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Button variants mirror DESIGN.md's `components.button*` tokens exactly:
 * default (primary), action (secondary/orange, single-highest-intent CTA —
 * see DESIGN.md Do's/Don'ts: only one per screen), secondary (outline),
 * ghost, and icon (36x36 circular). Typography follows the `label` token
 * (Figtree/14px/600), which is what `{typography.label}` resolves to in the
 * frontmatter — not the heading font, despite the prose calling buttons
 * "heading-font label" (frontmatter token wins per the task's exact-values
 * rule).
 *
 * Sizes (sm/md/lg) are NOT defined in DESIGN.md (it gives one padding value
 * per button type) — extended here as a judgment call, scaling from the
 * `spacing.2` base padding.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full text-label font-sans transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-background hover:bg-accent-600',
        action: 'bg-secondary text-text hover:bg-accent-2-400',
        secondary: 'border border-border bg-transparent text-text hover:bg-surface',
        ghost: 'bg-transparent text-primary hover:bg-accent-100',
        icon: 'size-9 rounded-full bg-surface text-primary hover:bg-neutral-200',
      },
      size: {
        sm: 'px-3 py-1',
        md: 'px-4 py-2',
        lg: 'px-6 py-3',
      },
    },
    compoundVariants: [{ variant: 'icon', className: 'p-0' }],
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

/**
 * Exported so link-as-button usage (e.g. `next/link` CTAs) can apply the
 * exact same variant classes without an `asChild`/Slot indirection — kept
 * out of scope deliberately (no extra dependency for a single use case).
 */
export { buttonVariants };
