'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface FilterSectionOption {
  value: string
  label: string
}

export interface FilterSectionProps {
  'label': string
  'options': FilterSectionOption[]
  'selected': string[]
  'onToggle': (value: string) => void
  'countFor': (value: string) => number
  'defaultOpen'?: boolean
  'data-testid'?: string
}

/**
 * One collapsible facet inside `FilterDrawer` (FRESCO-273) — reused for
 * Comida/Cocina/Dieta/Alérgeno. No shared Accordion primitive exists yet in
 * this design system, and this is the only place four near-identical
 * disclosures are needed, so it lives here rather than under `components/ui/`.
 */
export function FilterSection({ label, options, selected, onToggle, countFor, defaultOpen = false, 'data-testid': dataTestId }: FilterSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        data-testid={dataTestId}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-label text-text">
          {label}
          {selected.length > 0 && ` (${selected.length})`}
        </span>
        <ChevronDown className={cn('size-4 text-tertiary transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {options.map((option) => {
            const isChecked = selected.includes(option.value);
            const resultCount = countFor(option.value);
            return (
              <label key={option.value} className="flex cursor-pointer items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Checkbox checked={isChecked} onChange={() => onToggle(option.value)} />
                  <span className="text-body-md text-text">{option.label}</span>
                </span>
                <span className="text-body-sm text-tertiary">{resultCount}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
