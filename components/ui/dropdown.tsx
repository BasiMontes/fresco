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
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.find(option => option.value === value) ?? null;
  // FRESCO-151: WebKit (confirmed via playwright --browser=webkit +
  // real iPhone report) fires a phantom second `click` on the trigger
  // button right after the option's own click closes the list — a
  // touch-to-mouse-event synthesis quirk, not something we can prevent
  // upstream. This ref lets the trigger's onClick recognize and swallow
  // that immediate follow-up instead of treating it as a real toggle.
  const justSelectedRef = useRef(false);

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

  // FRESCO-181: WAI-ARIA listbox keyboard pattern needs the active option
  // focused on open, not left on whatever the browser defaults to.
  useEffect(() => {
    if (open) {
      const initialIndex = selected ? options.findIndex(option => option.value === selected.value) : 0;
      setActiveIndex(initialIndex === -1 ? 0 : initialIndex);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      optionRefs.current[activeIndex]?.focus();
    }
  }, [open, activeIndex]);

  function selectOption(optionValue: string) {
    justSelectedRef.current = true;
    setOpen(false);
    onChange(optionValue);
  }

  function moveActive(nextIndex: number) {
    setActiveIndex(Math.max(0, Math.min(options.length - 1, nextIndex)));
  }

  function handleListKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(activeIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(activeIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveActive(0);
        break;
      case 'End':
        event.preventDefault();
        moveActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectOption(options[activeIndex].value);
        triggerRef.current?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        data-testid={dataTestId}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-between rounded-full border border-border bg-surface px-3 text-body-md text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => {
          if (justSelectedRef.current) {
            justSelectedRef.current = false;
            return;
          }
          setOpen(current => !current);
        }}
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
          onKeyDown={handleListKeyDown}
          className="absolute top-full left-0 z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-lg"
        >
          {options.map((option, index) => (
            <li key={option.value}>
              <button
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                tabIndex={index === activeIndex ? 0 : -1}
                aria-selected={option.value === value}
                className={cn(
                  'w-full rounded-full px-3 py-2 text-left text-body-md',
                  option.value === value
                    ? 'bg-primary text-background'
                    : 'text-text hover:bg-accent-300',
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
