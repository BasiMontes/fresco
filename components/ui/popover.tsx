'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Hand-rolled accessible popover primitive (FRESCO-514) — no popover/menu
 * library exists in this codebase (`package.json` has no `@radix-ui/*`
 * dependency, and every other `components/ui/*` overlay is a bare
 * `forwardRef`/hooks wrapper over Tailwind, matching `Dialog`'s own
 * doc-comment reasoning for staying hand-rolled). Follows `Dialog`'s focus
 * trap / Escape-to-close / focus-return-on-close effects, but there's no
 * scrim and no body-scroll lock, and it closes on any outside mousedown
 * (`Dropdown`'s click-outside pattern) rather than requiring a scrim click.
 *
 * Composition mirrors `Dialog`: this component owns only the panel/content,
 * not the trigger — the caller renders its own trigger element (with
 * `aria-expanded`) and passes a `ref` to it as `triggerRef`, used for two
 * things: (1) excluding it from the click-outside check — otherwise a
 * `mousedown` on the trigger itself (while open) reads as "outside", queuing
 * a close that the trigger's own `click` handler then immediately re-opens
 * against stale state (FRESCO-514 fix-and-iterate, PR #361 review); (2)
 * measuring its position to portal the panel to `document.body` with
 * `position: fixed` coordinates (FRESCO-514 second fix-and-iterate) — the
 * caller's own ancestor chain (e.g. `sidebar.tsx`'s `<aside overflow-x-hidden>`)
 * can otherwise hard-clip an in-flow `absolute` panel regardless of which
 * edge it anchors from, especially from a narrow trigger like a collapsed
 * icon-rail avatar. When `triggerRef` is omitted, the panel falls back to
 * plain in-flow `absolute` positioning against the nearest `relative`
 * ancestor the caller provides — same contract as before this fix.
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
  /**
   * The caller's trigger element. Excluded from the click-outside check,
   * and — when provided — used to portal + position the panel via
   * `getBoundingClientRect()` so it can render outside a clipping ancestor.
   */
  'triggerRef'?: React.RefObject<HTMLElement | null>
  /**
   * Match the panel's width to the trigger's rendered width (default
   * `true`). Set `false` when the trigger is too narrow to host a usable
   * panel (e.g. an avatar-only collapsed-rail trigger) — the panel then
   * keeps its own natural width (`min-w-[220px]` plus any width class in
   * `className`). Has no effect when `triggerRef` is omitted.
   */
  'matchTriggerWidth'?: boolean
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
/** Gap between the trigger's top edge and the panel's bottom edge — matches the Tailwind `mb-2` this replaces for the portaled/measured case. */
const TRIGGER_GAP_PX = 8;

export function Popover({ open, onOpenChange, children, 'aria-label': ariaLabel, className, 'data-testid': dataTestId, triggerRef, matchTriggerWidth = true }: PopoverProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  const [position, setPosition] = React.useState<{ left: number, bottom: number, width?: number } | null>(null);

  // Measure the trigger and position the panel via `position: fixed` +
  // viewport coordinates, so it can be portaled straight to `document.body`
  // — escaping any ancestor's `overflow-hidden` clip instead of relying on
  // in-flow `absolute` anchoring inside it. Runs synchronously before paint
  // (`useLayoutEffect`) so there's no visible flash at the old position.
  React.useLayoutEffect(() => {
    if (!open || !triggerRef?.current) { setPosition(null); return; }
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      left: rect.left,
      bottom: window.innerHeight - rect.top + TRIGGER_GAP_PX,
      width: matchTriggerWidth ? rect.width : undefined,
    });
  }, [open, triggerRef, matchTriggerWidth]);

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

  // Decided from the `triggerRef` PROP alone (stable for the caller's whole
  // session), never from whether `position` has been measured yet. Deriving
  // this from measured state instead caused a real bug: the very first
  // commit after opening (before the position `useLayoutEffect` has run)
  // would render the plain in-flow `<div>`, then the effect's `setPosition`
  // would flip it to `createPortal(...)` on the next commit — a HostComponent
  // → HostPortal type change AT THE SAME TREE POSITION, which React can't
  // update in place, so it unmounts the first `<div>` (nulling `panelRef`)
  // and mounts a fresh one inside the portal. The focus-trap effect's
  // auto-focus-first-item call landed on the already-unmounted node and
  // silently no-opped — `Popover > traps Tab focus inside the open panel`
  // failed because focus never actually moved. Keeping `usePortal` constant
  // across the whole open session means the SAME `<div>` (and `panelRef`)
  // persists from the first commit onward; only its inline position style
  // updates once measured — a normal re-render, not a remount.
  const usePortal = triggerRef != null;

  const panel = (
    <div
      ref={panelRef}
      aria-label={ariaLabel}
      tabIndex={-1}
      data-testid={dataTestId}
      style={usePortal
        ? position
          ? { position: 'fixed', left: position.left, bottom: position.bottom, width: position.width }
          // Not measured yet (this commit lands before the position
          // `useLayoutEffect` runs, which is before paint) — parked
          // off-screen instead of at the default static flow position, so
          // there's no visible flash at the wrong spot.
          : { position: 'fixed', left: -9999, top: -9999 }
        : undefined}
      className={cn(
        // `dropdown: 100` (DESIGN.md's Z-index layer convention) — once
        // portaled, this panel is a direct child of `<body>`, a sibling of
        // the page's other top-level layers, so its z-index genuinely has
        // to out-rank ordinary page content (unlike the pre-portal version,
        // where the sidebar's own `position: sticky` stacking context made
        // this moot). `dropdown: 100` is comfortably above regular content.
        'z-[100] min-w-[220px] rounded-card border border-border bg-surface p-1 shadow-lg focus:outline-none',
        !usePortal && 'absolute bottom-full left-0 mb-2',
        className,
      )}
    >
      {children}
    </div>
  );

  return usePortal ? createPortal(panel, document.body) : panel;
}
