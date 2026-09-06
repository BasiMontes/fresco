import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Input mirrors DESIGN.md's `components.input` token: pill-shaped, surface
 * background. Border is `neutral-600`, not the `{colors.border}` text-at-16%
 * hairline: on the cream page (`#FAF3E3`) that hairline measures ~1.2:1,
 * below WCAG 2.2 SC 1.4.11's 3:1 for a UI-component boundary. `neutral-600`
 * keeps the 1px width but clears 3:1 on page, card, and the field's own
 * `surface` fill (FRESCO-443; see master-design-plan §5-N).
 */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-9 w-full rounded-full border border-neutral-600 bg-surface px-3 text-body-md text-text placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        type === 'number'
        && '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
