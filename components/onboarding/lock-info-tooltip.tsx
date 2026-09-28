'use client';

import { useState } from 'react';

/**
 * Shared "why is this locked" disclosure — the vegano→vegetariano lock
 * (AC-2) and the FRESCO-275 dieta→alérgeno locks share this same small
 * info-button + tooltip shape. Extracted from `app/onboarding/page.tsx`
 * (A5-M1, god-component split) — no behavior change from the original
 * inline implementation.
 */
export function LockInfoTooltip({ message, testIdPrefix }: { message: string, testIdPrefix: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        data-testid={`${testIdPrefix}_lock_info`}
        aria-label="Por qué está bloqueado"
        aria-expanded={open}
        className="flex size-4 items-center justify-center rounded-full border border-tertiary text-caption text-tertiary"
        onClick={() => setOpen(current => !current)}
      >
        i
      </button>
      <span
        role="tooltip"
        className={`absolute top-full left-1/2 z-10 mt-1 w-56 -translate-x-1/2 rounded-md bg-primary px-2 py-1.5 text-caption text-on-brand ${open ? '' : 'pointer-events-none opacity-0'} group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {message}
      </span>
    </span>
  );
}
