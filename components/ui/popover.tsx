'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Hand-rolled accessible popover primitive (FRESCO-514) — no popover/menu
 * library exists in this codebase (`package.json` has no `@radix-ui/*`
 * dependency, and every other `components/ui/*` overlay is a bare
 * `forwardRef`/hooks wrapper over Tailwind, matching `Dialog`'s own
 * doc-comment reasoning for staying hand-rolled). Follows `Dialog`'s focus
 * trap / Escape-to-close / focus-return-on-close effects, but is NOT a
 * portal-to-`document.body` full-screen overlay like `Dialog` — it's an
 * anchored, absolutely-positioned panel (like `Dropdown`'s listbox), so
 * there's no scrim and no body-scroll lock, and it closes on any outside
 * mousedown (`Dropdown`'s click-outside pattern) rather than requiring a
 * scrim click.
 *
 * Composition mirrors `Dialog`: this component owns only the panel/content,
 * not the trigger — the caller renders its own trigger element (with
 * `aria-expanded`) inside a `relative`-positioned wrapper alongside
 * `<Popover>`, so the panel's `absolute` positioning anchors against that
 * wrapper. The caller also passes a `ref` to its trigger element as
 * `triggerRef` so the click-outside check below can exclude it — otherwise
 * a `mousedown` on the trigger itself (while open) reads as "outside",
 * queuing a close that the trigger's own `click` handler then immediately
 * re-opens against stale state (FRESCO-514 fix-and-iterate, PR #361 review).
 *
 * No `role="menu"`/`role="menuitem"` here (FRESCO-514 fix-and-iterate):
 * that WAI-ARIA pattern requires arrow-key roving navigation this
 * implementation doesn't provide, and most callers use this for plain page
 * navigation, not a command menu — APG discourages `menu`/`menuitem` for
 * that. This stays a plain, accessible group of links/buttons (`aria-label`
 * only), matching `Dropdown`'s `aria-haspopup`/`aria-expanded`-on-trigger
 * convention rather than promising menu keyboard semantics. The Tab-trap +
 * focus-return-on-close behavior below is still fine to keep as general
 * "popover panel" behavior — it isn't tied to the menu role.
 */
export interface PopoverProps {
  'open': boolean
  'onOpenChange': (open: boolean) => void
  'children': React.ReactNode
  'aria-label': string
  'className'?: string
  'data-testid'?: string
  /** The caller's trigger element — excluded from the click-outside check. */
  'triggerRef'?: React.RefObject<HTMLElement | null>
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Popover({ open, onOpenChange, children, 'aria-label': ariaLabel, className, 'data-testid': dataTestId, triggerRef }: PopoverProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  // Click-outside-to-close (`Dropdown`'s `mousedown` pattern) — scoped to
  // `open` so no listener sits on `document` while closed.
  React.useEffect(() => {
    if (!open) { return; }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) { return; }
      if (triggerRef?.current?.contains(target)) { return; }
      onOpenChange(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onOpenChange, triggerRef]);

  // Focus trap + Escape-to-close + focus-return-on-close, keyed on `open`
  // exactly like `Dialog`'s equivalent effect.
  React.useEffect(() => {
    if (!open) { return; }

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? panel)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false);
        return;
      }
      if (event.key !== 'Tab' || !panel) { return; }

      const nodes = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
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
      previouslyFocused.current?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) { return null; }

  return (
    <div
      ref={panelRef}
      aria-label={ariaLabel}
      tabIndex={-1}
      data-testid={dataTestId}
      className={cn(
        // FRESCO-514 fix-and-iterate — `dropdown: 100` (DESIGN.md's
        // Z-index layer convention), not the `modal: 1000` band `Dialog`
        // reserves: `sidebar.tsx`'s `<aside>` is `position: sticky`, which
        // unconditionally creates its own stacking context, so this
        // panel's z-index only has to out-rank *other* elements inside the
        // aside (there are none with a non-auto z-index) — it plays no
        // part in how the aside's whole subtree stacks against page
        // siblings. `z-[1000]` and `z-[100]` render identically here; the
        // token is the correct one, no divergence needed (see
        // master-design-plan.md §5-V, removed alongside this).
        'absolute z-[100] min-w-[220px] rounded-card border border-border bg-surface p-1 shadow-lg focus:outline-none',
        className,
      )}
    >
      {children}
    </div>
  );
}
