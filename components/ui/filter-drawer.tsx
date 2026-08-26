'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Full-screen filter/sort panel (FRESCO-273) — slides up from the bottom
 * edge, header fixed on top, body scrolls, footer (the confirm CTA) stays
 * sticky at the bottom. Same portal/focus-trap/ESC/scroll-lock lifecycle as
 * `components/ui/dialog.tsx`, kept as a separate implementation rather than
 * sharing a hook: Dialog's FRESCO-247 mount-timing fix is delicate, and a
 * second consumer isn't worth the risk of destabilizing it.
 */
export interface FilterDrawerProps {
  'open': boolean
  'onOpenChange': (open: boolean) => void
  'title': string
  'onClearAll': () => void
  'footer': React.ReactNode
  'children': React.ReactNode
  'aria-label': string
  'data-testid'?: string
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function readCssDurationMs(propertyName: string, fallbackMs: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(propertyName).trim();
  const value = Number.parseFloat(raw);
  if (!raw || Number.isNaN(value)) { return fallbackMs; }
  return raw.endsWith('ms') ? value : value * 1000;
}

export function FilterDrawer({ open, onOpenChange, title, onClearAll, footer, children, 'aria-label': ariaLabel, 'data-testid': dataTestId }: FilterDrawerProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  const [shouldRender, setShouldRender] = React.useState(open);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isClosing = shouldRender && !open;

  const [hasEntered, setHasEntered] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!shouldRender || !open) {
      setHasEntered(false);
      return;
    }

    let rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        setHasEntered(true);
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [shouldRender, open]);

  React.useEffect(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (open) {
      setShouldRender(true);
      return;
    }

    if (!shouldRender) { return; }

    const closeMs = readCssDurationMs('--modal-close-dur', 150);
    closeTimeoutRef.current = setTimeout(() => {
      setShouldRender(false);
      closeTimeoutRef.current = null;
    }, closeMs);

    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [open, shouldRender]);

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

  if (!shouldRender) { return null; }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-text/50"
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
          't-drawer absolute inset-x-0 bottom-0 flex max-h-[92vh] w-full flex-col rounded-t-card bg-surface shadow-lg focus:outline-none',
          open && hasEntered && 'is-open',
          isClosing && 'is-closing',
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
          <h2 className="text-h6 uppercase text-text">{title}</h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClearAll}
              data-testid={dataTestId ? `${dataTestId}_clear_all_button` : undefined}
              className="text-body-sm font-semibold text-primary underline underline-offset-2"
            >
              Borrar todo
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Cerrar"
              data-testid={dataTestId ? `${dataTestId}_close_button` : undefined}
              className="rounded-full p-1 text-tertiary hover:bg-neutral-200"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        <div className="shrink-0 border-t border-border p-4">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}
