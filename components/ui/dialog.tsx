'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Hand-rolled accessible modal primitive (FRESCO-51) — no dialog/overlay
 * library exists in this codebase yet (every other `components/ui/*`
 * component is a bare cva/forwardRef wrapper over Tailwind, so this follows
 * the same pattern rather than introducing Radix for a single use case).
 * Uses DESIGN.md's `shadow.lg` token, explicitly reserved for "true overlays
 * (modals, sheets)", and the documented `modal: 1000` z-index convention.
 */
export interface DialogProps {
  'open': boolean
  'onOpenChange': (open: boolean) => void
  'children': React.ReactNode
  'aria-label': string
  'className'?: string
  'data-testid'?: string
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onOpenChange, children, 'aria-label': ariaLabel, className, 'data-testid': dataTestId }: DialogProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  // Focus trap + Escape-to-close + body scroll lock while `open`. Keyed on
  // `open`, not `[]` — the caller keeps this component mounted across
  // open/close toggles (only the returned JSX changes below), so a mount-once
  // effect would only ever run while `open` was still false and never again.
  // Found live: focus silently never moved into the dialog on open.
  React.useEffect(() => {
    if (!open) { return; }

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const content = contentRef.current;
    const focusable = content?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? content)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false);
        return;
      }
      if (event.key !== 'Tab' || !content) { return; }

      const nodes = content.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (nodes.length === 0) { return; }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  if (!open) { return null; }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-text/50 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        data-testid={dataTestId}
        onClick={event => event.stopPropagation()}
        className={cn(
          'max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-card bg-surface p-4 shadow-lg focus:outline-none sm:p-6',
          className,
        )}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Cerrar"
          data-testid={dataTestId ? `${dataTestId}_close_button` : undefined}
          className="float-right rounded-full p-1 text-tertiary hover:bg-neutral-200"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
