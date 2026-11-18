'use client';

import type { KeyboardEvent } from 'react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * FRESCO-1225 — every option visible at once as a card (a dropdown hides up
 * to 6 options behind a tap without saving space). ARIA APG `radiogroup`:
 * one Tab stop (roving tabindex), arrow keys move focus AND selection with
 * wrap-around. Cards are at least 44 px tall (WCAG 2.5.5). Selected state
 * follows the `tag-selected` token (filled primary), unselected the card
 * hairline from DESIGN.md.
 */
export interface OptionCardOption<T extends string = string> {
  value: T
  label: string
  /** Optional one-line help shown under the label. */
  description?: string
}

export interface OptionCardGroupProps<T extends string = string> {
  'options': OptionCardOption<T>[]
  'value': T | null
  'onChange': (value: T) => void
  /** 1 stacks the cards, 2 lays them out in two columns from the smallest width. */
  'columns'?: 1 | 2
  'className'?: string
  'aria-label': string
  /** Group test id; each card gets `<id>_option_<value>`. */
  'data-testid'?: string
}

export function OptionCardGroup<T extends string = string>({
  options,
  value,
  onChange,
  columns = 2,
  className,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
}: OptionCardGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const hasSelection = options.some(option => option.value === value);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (delta === 0) {
      return;
    }
    event.preventDefault();
    const nextIndex = (index + delta + options.length) % options.length;
    const next = options[nextIndex];
    if (!next) {
      return;
    }
    onChange(next.value);
    refs.current[nextIndex]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={dataTestId}
      className={cn('grid gap-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-1', className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => { refs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (!hasSelection && index === 0) ? 0 : -1}
            data-testid={dataTestId ? `${dataTestId}_option_${option.value}` : undefined}
            onClick={() => onChange(option.value)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={cn(
              'flex min-h-11 flex-col items-start justify-center rounded-md border px-3 py-2 text-left font-sans transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              selected
                ? 'border-primary bg-primary text-on-brand'
                : 'border-neutral-600 bg-surface text-text hover:bg-neutral-200',
            )}
          >
            <span className="text-body-sm font-semibold">{option.label}</span>
            {option.description && (
              <span className={cn('text-caption', selected ? 'text-on-brand' : 'text-tertiary')}>{option.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
