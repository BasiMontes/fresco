'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';

// Deliberately simple format check (not RFC 5322) — matches the level of
// validation `type="email"` already implies, just surfaced as an inline
// Spanish message instead of only the browser's native (English, easy to
// miss) tooltip. Real deliverability is never provable client-side.
const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s.@]+(?:\.[^\s.@]+)+$/;

export interface EmailInputProps {
  'value': string
  'onChange': (value: string) => void
  'data-testid'?: string
  'disabled'?: boolean
}

/**
 * FRESCO-198: email field "con todas sus restricciones" — required format
 * validated inline, surfaced only after the field is touched (blurred) so
 * an empty field doesn't flash an error before she's even typed anything.
 */
export function EmailInput({ value, onChange, 'data-testid': dataTestId = 'email_input', disabled }: EmailInputProps) {
  const [touched, setTouched] = useState(false);
  const isValid = EMAIL_FORMAT_REGEX.test(value);
  const showError = touched && value.length > 0 && !isValid;

  return (
    <div className="flex flex-col gap-1">
      <Input
        data-testid={dataTestId}
        type="email"
        placeholder="Correo electrónico"
        aria-label="Correo electrónico"
        aria-invalid={showError}
        required
        autoComplete="email"
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        className={showError ? 'border-error' : ''}
      />
      {showError && (
        <p data-testid="email_validation_message" role="alert" aria-live="polite" className="text-body-sm text-error">
          Introduce un email válido.
        </p>
      )}
    </div>
  );
}
