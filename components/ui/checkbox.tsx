'use client';

import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Circular checkbox (FRESCO-191) — a real `<input type="checkbox">` for
 * native keyboard/form/a11y semantics, `appearance-none` + a sibling check
 * icon drawing the checked state by hand. Confirmed live: `appearance:
 * auto` ignores `border-radius` on an unstyled native checkbox in every
 * browser tested, so the circular shape from the Stitch mockup needed a
 * real styled component instead of a plain `<input type="checkbox">`.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'peer size-5 shrink-0 appearance-none rounded-full border-2 border-tertiary bg-transparent transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          className,
        )}
        {...props}
      />
      <Check
        className="pointer-events-none absolute size-3.5 text-background opacity-0 peer-checked:opacity-100"
        aria-hidden="true"
        strokeWidth={3}
      />
    </span>
  ),
);
Checkbox.displayName = 'Checkbox';
