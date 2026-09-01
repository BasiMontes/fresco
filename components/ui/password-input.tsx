'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { MIN_PASSWORD_LENGTH } from '@/lib/validation/password-policy';
import { getPasswordStrength, PASSWORD_STRENGTH_LABELS } from '@/lib/validation/password-strength';

export interface PasswordInputProps {
  'value': string
  'onChange': (value: string) => void
  'data-testid'?: string
  'placeholder'?: string
  'autoComplete'?: 'new-password' | 'current-password'
  /** Show the live strength meter — off for a login field, on for signup. */
  'showStrength'?: boolean
  'disabled'?: boolean
}

const STRENGTH_BAR_COLOR: Record<ReturnType<typeof getPasswordStrength>, string> = {
  weak: 'bg-error',
  medium: 'bg-warning',
  strong: 'bg-success',
};

const STRENGTH_TEXT_COLOR: Record<ReturnType<typeof getPasswordStrength>, string> = {
  weak: 'text-error',
  // Not text-warning (#df8c26): amber-on-cream is ~2,4:1, fails WCAG AA.
  // accent-2-700 is the darker amber-as-text token (FRESCO-283 / FRESCO-299).
  medium: 'text-accent-2-700',
  strong: 'text-success',
};

/**
 * FRESCO-198: "contraseña fuerte, con un icono de un ojo e información de
 * cuanto de fuerte está siendo la contraseña". Show/hide toggle + a live
 * strength meter (`lib/validation/password-strength.ts`), shown only once
 * she's typed something so an empty field doesn't render a "floja" bar.
 */
export function PasswordInput({
  value,
  onChange,
  'data-testid': dataTestId = 'password_input',
  placeholder = 'Contraseña',
  autoComplete = 'new-password',
  showStrength = true,
  disabled,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const strength = getPasswordStrength(value);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Input
          data-testid={dataTestId}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          aria-label={placeholder}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          data-testid="password_toggle_visibility_button"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          onClick={() => setVisible(v => !v)}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible
            ? <EyeOff className="size-4" aria-hidden="true" />
            : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <div data-testid="password_strength_indicator" className="flex items-center gap-2">
          <div className="flex h-1 flex-1 gap-1" role="presentation">
            {(['weak', 'medium', 'strong'] as const).map((level, index) => {
              const strengthOrder = { weak: 0, medium: 1, strong: 2 };
              const filled = index <= strengthOrder[strength];
              return (
                <div
                  key={level}
                  className={`h-1 flex-1 rounded-full ${filled ? STRENGTH_BAR_COLOR[strength] : 'bg-surface'}`}
                />
              );
            })}
          </div>
          <span role="status" aria-live="polite" className={`text-caption font-sans ${STRENGTH_TEXT_COLOR[strength]}`}>
            {PASSWORD_STRENGTH_LABELS[strength]}
          </span>
        </div>
      )}
    </div>
  );
}
