'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface SwitchProps {
  'checked': boolean
  'onCheckedChange': (checked: boolean) => void
  'disabled'?: boolean
  'aria-label'?: string
  'data-testid'?: string
  'className'?: string
}

/**
 * Toggle switch primitive (FRESCO-443) — DESIGN.md §Components `switch`.
 * ON track `{colors.primary}`, OFF track `{colors.neutral-300}` + a
 * `{colors.border}` hairline (a solid `var()` fill, unlike the previous
 * `bg-tertiary/30` inline markup whose opacity modifier collapsed to
 * transparent on a hex-valued token — the OFF track was invisible). Knob is
 * the card-surface token `{colors.surface-raised}` with a soft shadow. Focus
 * ring matches `Button` (`ring-2` + `ring-offset-2`). A native `<button>`
 * carries Space/Enter activation and the `forwardRef`.
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled, className, 'aria-label': ariaLabel, 'data-testid': dataTestId }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-testid={dataTestId}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-primary bg-primary' : 'border-border bg-neutral-300',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-5 translate-x-0.5 rounded-full bg-surface-raised shadow transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  ),
);
Switch.displayName = 'Switch';
