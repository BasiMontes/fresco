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
  // FRESCO-451 (slice 5/5): disabled:opacity-50 halved an already-light label
  // color on top of a colored fill — two compounding reductions left disabled
  // buttons genuinely hard to read, not just visually "off". opacity-65 still
  // reads as disabled (paired with pointer-events-none + no hover) without
  // crushing the text.
  'inline-flex items-center justify-center gap-2 rounded-full text-label font-sans transition-colors disabled:pointer-events-none disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        // FRESCO-448 §Dark mode: `text-on-brand` / `text-on-warning` are
        // theme-stable — `text-background` / `text-text` flipped to the wrong
        // end in dark and killed the label contrast on the fill.
        default: 'bg-primary text-on-brand hover:bg-accent-600',
        action: 'bg-secondary text-on-warning hover:bg-accent-2-400',
        // FRESCO-448 (S5): `border-border` (text @16% ≈ 1.2:1 on the page) is
        // below WCAG 2.2 SC 1.4.11's 3:1 for a control boundary — and this
        // variant's transparent fill means the border is the whole affordance.
        // `neutral-600` matches the input border contract from FRESCO-443.
        secondary: 'border border-neutral-600 bg-transparent text-text hover:bg-surface',
        ghost: 'bg-transparent text-primary hover:bg-accent-100',
        icon: 'size-9 rounded-full bg-surface text-primary hover:bg-neutral-200',
      },
      size: {
        // FRESCO-478: WCAG 2.5.5 — every button is a >=44px-tall tap target.
        // The `icon` variant keeps its 36x36 circular footprint (min-h reset
        // in compoundVariants below).
        sm: 'min-h-[44px] px-3 py-1',
        md: 'min-h-[44px] px-4 py-2',
        lg: 'min-h-[44px] px-6 py-3',
      },
    },
    compoundVariants: [{ variant: 'icon', className: 'min-h-0 p-0' }],
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
