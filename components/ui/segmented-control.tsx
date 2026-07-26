'use client';

import { cn } from '@/lib/utils';

/**
 * Mirrors DESIGN.md's `components.segmented-control` token: a radio-style
 * pill group (`rounded.md`, not full — the one exception in a system where
 * "everything is pill-shaped"). The checked option flips to filled primary;
 * unchecked options stay transparent within the shared outlined container.
 * Example usage from DESIGN.md: spice-level ("Suave / Medio / Picante").
 */
export interface SegmentedControlOption {
  value: string
  label: string
}

export interface SegmentedControlProps {
  'options': SegmentedControlOption[]
  'value': string
  'onChange': (value: string) => void
  'className'?: string
  'aria-label'?: string
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ...aria
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      className={cn('inline-flex gap-1 rounded-md border border-border bg-surface p-1', className)}
      {...aria}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md px-3 py-1 text-body-sm font-sans transition-colors',
              isSelected ? 'bg-primary text-background' : 'bg-transparent text-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
