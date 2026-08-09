'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface DropdownOption {
  value: string
  label: string
}

export interface DropdownProps {
  'options': DropdownOption[]
  'value': string | null
  'onChange': (value: string) => void
  'placeholder'?: string
  'className'?: string
  'data-testid'?: string
  'aria-label'?: string
}

/**
 * Design-system dropdown — replaces the native `<select>` per FRESCO-132
 * (onboarding wants a component that looks/behaves consistently with the
 * rest of the app, not the browser's own picker UI). Custom listbox, not a
 * native `<select>` under the hood: `role="listbox"`/`role="option"` +
 * keyboard support (Enter/Space to open, Arrow keys to move, Escape to
 * close), matching `Input`'s pill/`bg-surface` tokens.
 */
export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Selecciona una opción',
  className,
  'data-testid': dataTestId,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function selectOption(optionValue: string) {
    onChange(optionValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        data-testid={dataTestId}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-between rounded-full border border-border bg-surface px-3 text-body-md text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => setOpen(current => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      >
        <span className={selected ? '' : 'text-neutral-500'}>
          {selected?.label ?? placeholder}
        </span>
        <span aria-hidden="true" className="ml-2 text-tertiary">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute top-full left-0 z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-lg"
        >
          {options.map(option => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={cn(
                  'w-full rounded-full px-3 py-2 text-left text-body-md hover:bg-primary-light',
                  option.value === value ? 'bg-primary-light text-primary' : 'text-text',
                )}
                onClick={() => selectOption(option.value)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
