'use client';

import type { KeyboardEvent } from 'react';
import type { ThemePreference } from '@/lib/theme/theme';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { applyThemePreference, isThemePreference, THEME_COOKIE } from '@/lib/theme/theme';
import { cn } from '@/lib/utils';

/**
 * Theme preference control (FRESCO-448 §Dark mode).
 *
 * A three-segment radio group — claro / automático / oscuro — styled after
 * DESIGN.md's `segmented-control` token (`rounded.md` container, checked
 * segment filled `primary`). Placed in the desktop sidebar footer and, for
 * mobile (no sidebar), as a row on `/profile`.
 *
 * The actual swap is done by `applyThemePreference` (cookie + `<html>`
 * attribute) so it is instant and survives reload — `app/layout.tsx` reads
 * the same cookie server-side on the next request. This component only
 * mirrors the current value for the control's checked state; it never owns
 * the source of truth.
 *
 * `tone="inverse"` is for the green sidebar ground, where the default
 * hairline + tertiary-brown text have no contrast (same override pattern as
 * `SidebarAccount`'s plan tag).
 */
const OPTIONS: readonly { value: ThemePreference, label: string, Icon: typeof Sun }[] = [
  { value: 'light', label: 'Tema claro', Icon: Sun },
  { value: 'system', label: 'Tema automático (según el sistema)', Icon: Monitor },
  { value: 'dark', label: 'Tema oscuro', Icon: Moon },
];

function readCookiePreference(): ThemePreference {
  if (typeof document === 'undefined') { return 'system'; }
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  const value = match?.[1];
  return isThemePreference(value) ? value : 'system';
}

export interface ThemeToggleProps {
  tone?: 'default' | 'inverse'
  className?: string
}

export function ThemeToggle({ tone = 'default', className }: ThemeToggleProps) {
  // Server render and first client paint must agree, so start at `system`
  // (the SSR assumption when no attribute is stamped) and reconcile from the
  // real cookie after mount.
  const [preference, setPreference] = useState<ThemePreference>('system');
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setPreference(readCookiePreference());
  }, []);

  function select(next: ThemePreference) {
    setPreference(next);
    applyThemePreference(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const isNext = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const isPrev = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!isNext && !isPrev) { return; }
    event.preventDefault();
    const delta = isNext ? 1 : -1;
    const nextIndex = (index + delta + OPTIONS.length) % OPTIONS.length;
    const next = OPTIONS[nextIndex];
    if (!next) { return; }
    select(next.value);
    buttonRefs.current[nextIndex]?.focus();
  }

  const isInverse = tone === 'inverse';

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la interfaz"
      data-testid="theme_toggle"
      className={cn(
        'inline-flex gap-1 rounded-md border p-1',
        // FRESCO-169 precedent: an opacity modifier (`/25`, `/10`) on a color
        // defined as a raw `var(--color-*)` reference silently resolves to
        // fully transparent — the border then fell back to Tailwind's own
        // preflight gray. `color-mix()` arbitrary values sidestep Tailwind's
        // opacity pipeline entirely and compile to valid CSS regardless.
        isInverse
          ? 'border-[color-mix(in_srgb,var(--color-background)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-background)_10%,transparent)]'
          : 'border-border bg-surface',
        className,
      )}
    >
      {OPTIONS.map((option, index) => {
        const isSelected = option.value === preference;
        const { Icon } = option;
        return (
          <button
            key={option.value}
            ref={(el) => { buttonRefs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.label}
            data-testid={`theme_toggle_${option.value}`}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => select(option.value)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={cn(
              'flex size-8 items-center justify-center rounded-[11.6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              isInverse
                ? 'focus-visible:ring-background focus-visible:ring-offset-primary'
                : 'focus-visible:ring-primary focus-visible:ring-offset-background',
              isSelected && isInverse && 'bg-background text-primary',
              isSelected && !isInverse && 'bg-primary text-on-brand',
              !isSelected && isInverse && 'text-background/75 hover:bg-background/10',
              !isSelected && !isInverse && 'text-tertiary hover:bg-neutral-200',
            )}
          >
            <Icon className="size-[18px]" strokeWidth={2} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
