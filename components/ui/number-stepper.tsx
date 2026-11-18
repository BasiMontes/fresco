'use client';

import { Minus, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * FRESCO-1225 — `-` / `+` buttons around a number field, stopping at `min`
 * and `max`. The field stays typeable (a typed 999 still reaches the caller's
 * validation and shows its message); the buttons never step outside the range.
 * Buttons are 44 px circles (WCAG 2.5.5), styled like the `icon` button.
 */
export interface NumberStepperProps {
  'label': string
  'value': number
  'min': number
  'max': number
  'onChange': (value: number) => void
  'invalid'?: boolean
  'className'?: string
  /** Field test id; the buttons get `<id>_decrement` / `<id>_increment`. */
  'data-testid': string
}

const BUTTON_CLASS = 'inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-neutral-600 bg-surface text-primary transition-colors hover:bg-neutral-200 disabled:pointer-events-none disabled:opacity-65 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function NumberStepper({ label, value, min, max, onChange, invalid = false, className, 'data-testid': dataTestId }: NumberStepperProps) {
  return (
    <div role="group" aria-label={label} className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        data-testid={`${dataTestId}_decrement`}
        aria-label={`Quitar uno: ${label}`}
        disabled={!(value > min)}
        onClick={() => onChange(Math.min(max, Math.max(min, value - 1)))}
        className={BUTTON_CLASS}
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <Input
        data-testid={dataTestId}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={cn('w-16 text-center', invalid && 'border-error')}
      />
      <button
        type="button"
        data-testid={`${dataTestId}_increment`}
        aria-label={`Añadir uno: ${label}`}
        disabled={!(value < max)}
        onClick={() => onChange(Math.max(min, Math.min(max, value + 1)))}
        className={BUTTON_CLASS}
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
