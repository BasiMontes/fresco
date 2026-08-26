'use client';

import type { KeyboardEvent } from 'react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Mirrors DESIGN.md's `components.segmented-control` token: a radio-style
 * pill group (`rounded.md`, not full — the one exception in a system where
 * "everything is pill-shaped"). The checked option flips to filled primary;
 * unchecked options stay transparent within the shared outlined container.
 * Example usage from DESIGN.md: spice-level ("Suave / Medio / Picante").
 *
 * FRESCO-272: the inner button's radius is the container's rounded-md (16px)
 * minus its own p-1 padding (4.4px) = 11.6px, not rounded-md itself. At this
 * container's actual rendered height, a plain rounded-md button auto-clamps
 * to a full capsule (CSS shrinks corner radii to fit the box), which is
 * MORE rounded than the container's literal 16px corner — the two curves
 * don't nest, leaving a crescent gap when the selected option sits at
 * either end. The explicit 11.6px keeps both curves concentric.
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
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // FRESCO-119: ARIA APG `radiogroup` pattern — Tab stops on the group once
  // (roving tabindex: only the checked option, or the first if none is
  // checked, is in the Tab order), left/right arrows move both focus AND
  // selection between options, wrapping at the ends.
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + delta + options.length) % options.length;
    const nextOption = options[nextIndex];
    if (!nextOption) {
      return;
    }
    onChange(nextOption.value);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      role="radiogroup"
      className={cn('inline-flex gap-1 rounded-md border border-border bg-surface p-1', className)}
      {...aria}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => { buttonRefs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected || (!options.some(o => o.value === value) && index === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={cn(
              'rounded-[11.6px] px-3 py-1 text-body-sm font-sans transition-colors',
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
