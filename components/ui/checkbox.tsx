'use client';

import { Check } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Circular checkbox (FRESCO-191) — a real `<input type="checkbox">` for
 * native keyboard/form/a11y semantics. Confirmed live (FRESCO-261): even
 * with `appearance: none` correctly applied, Chromium's native checkbox
 * still ignores `border-radius` on the `<input>` box itself entirely — set
 * it to `0px` via computed style and the rendered shape stays a perfect
 * circle regardless. So the visible box can't be the `<input>`; it's a
 * decorative sibling `<span>` instead (`peer-checked:*`), with the real
 * input made invisible (`opacity-0`, not `sr-only` — it still needs to sit
 * exactly over the visible box so clicks/taps land on it) but otherwise
 * fully interactive. This is what makes the shape genuinely overridable via
 * `className` (e.g. `rounded-sm` for a square variant) — passing a
 * different radius straight to the old `<input>`-as-box implementation had
 * no visual effect no matter what value was given.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        className="peer absolute inset-0 size-5 cursor-pointer opacity-0"
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 rounded-full border-2 border-tertiary bg-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
          className,
        )}
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
