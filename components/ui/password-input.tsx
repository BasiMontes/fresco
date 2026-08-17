'use client';

import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordStrength = 'weak' | 'medium' | 'strong';

const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: 'Débil',
  medium: 'Media',
  strong: 'Fuerte',
};

const STRENGTH_COLORS: Record<PasswordStrength, string> = {
  weak: 'bg-error',
  medium: 'bg-secondary',
  strong: 'bg-primary',
};

const STRENGTH_LEVEL: Record<PasswordStrength, number> = {
  weak: 1,
  medium: 2,
  strong: 3,
};

/**
 * FRESCO-198 — heuristic only (length + character-class variety), not a real
 * entropy estimate: no zxcvbn or similar dependency exists in this repo. A
 * visual nudge on top of the actually-enforced rule (Supabase's 6-char
 * minimum), not a replacement for it — callers keep validating that
 * separately.
 */
function getPasswordStrength(password: string): PasswordStrength | null {
  if (password.length < 6) { return null; }
  let score = 0;
  if (password.length >= 10) { score += 1; }
  if (/[A-Z]/.test(password)) { score += 1; }
  if (/\d/.test(password)) { score += 1; }
  if (/\W/.test(password)) { score += 1; }
  if (score <= 1) { return 'weak'; }
  if (score <= 2) { return 'medium'; }
  return 'strong';
}

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * FRESCO-198 — renders a 3-segment strength meter below the field, driven
   * by `value`. Only meaningful for a password being newly created (signup),
   * not for re-entering an existing one to prove ownership.
   */
  showStrength?: boolean
}

/** Password field with a show/hide toggle, and an optional strength meter (`showStrength`). */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showStrength, value, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const strength = showStrength && typeof value === 'string' ? getPasswordStrength(value) : null;

    return (
      <div>
        <div className="relative">
          <Input
            ref={ref}
            type={visible ? 'text' : 'password'}
            value={value}
            className={cn('pr-9', className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary"
          >
            {visible
              ? <EyeOff className="size-4" aria-hidden="true" />
              : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
        {strength && (
          <div className="mt-1.5 flex items-center gap-2" data-testid="password_strength_meter">
            <div className="flex flex-1 gap-1">
              {([1, 2, 3] as const).map(level => (
                <div
                  key={level}
                  className={cn(
                    'h-1 flex-1 rounded-full',
                    level <= STRENGTH_LEVEL[strength] ? STRENGTH_COLORS[strength] : 'bg-border',
                  )}
                />
              ))}
            </div>
            <span className="text-caption text-tertiary">{STRENGTH_LABELS[strength]}</span>
          </div>
        )}
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
