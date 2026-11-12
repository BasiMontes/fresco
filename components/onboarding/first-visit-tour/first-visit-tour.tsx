'use client';

import type { TourPlan } from '@/lib/tour/tour-stops';
import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { markTourSeen } from '@/lib/client-api/user-profile';
import { useTourStore } from '@/lib/store/tour-store';
import { placeCard } from '@/lib/tour/place-card';
import { getTourStops } from '@/lib/tour/tour-stops';
import { cn } from '@/lib/utils';
import { useTourAnchor } from './use-tour-anchor';

/**
 * FRESCO-1197 — the first-visit tour (`.context/design/master-design-plan.md` 4.21). A modal walk of five
 * stops over the real app: each stop opens the page it explains, lifts one zone of it and dims the rest.
 *
 * It starts on its own (`autoStart`, decided by the authenticated layout) or when the Configuración row
 * asks for a replay through `useTourStore`. Only a tour that started on its own records itself as seen:
 * a replay changes nothing on the account. Skip, close, Escape and Empezar all end it the same way, and
 * the person is taken back to the page they were on when it opened.
 *
 * Hand-rolled, like `Dialog`, because the layout is a lifted zone plus a card beside it, not a centred
 * modal; the same accessibility contract applies: labelled dialog, focus moves in and returns to where it
 * was, Tab stays inside, Escape closes. The arrows move between stops.
 */

const SMALL_SCREEN = '(max-width: 767px)';
const RING = 8;
/** On a small screen the floating tab bar sits at the bottom: the card keeps clear of it. */
const BOTTOM_INSET_SMALL = 96;
const BOTTOM_INSET_DESKTOP = 24;

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function subscribeNever() {
  return () => {};
}

function subscribeSmallScreen(onChange: () => void) {
  const query = window.matchMedia?.(SMALL_SCREEN);
  query?.addEventListener?.('change', onChange);
  return () => query?.removeEventListener?.('change', onChange);
}

function readSmallScreen() {
  return window.matchMedia?.(SMALL_SCREEN)?.matches ?? false;
}

interface FirstVisitTourProps {
  plan: TourPlan
  /** The layout decided this person has never seen the tour: it opens by itself and records itself. */
  autoStart: boolean
}

export function FirstVisitTour({ plan, autoStart }: FirstVisitTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const titleId = React.useId();
  const mounted = React.useSyncExternalStore(subscribeNever, () => true, () => false);
  const smallScreen = React.useSyncExternalStore(subscribeSmallScreen, readSmallScreen, () => false);

  const [open, setOpen] = React.useState(autoStart);
  const [index, setIndex] = React.useState(0);
  const [recordsSeen, setRecordsSeen] = React.useState(autoStart);
  const [position, setPosition] = React.useState<{ left: number, top: number } | null>(null);

  const originPath = React.useRef(pathname);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  const stops = React.useMemo(() => getTourStops(plan), [plan]);
  const stop = stops[index];
  const isLast = index === stops.length - 1;
  const hasZone = stop.anchoredOnMobile || !smallScreen;
  const rect = useTourAnchor(open && hasZone ? stop.anchor : null);

  // A replay asked from Configuración: start over from the first stop, without recording anything.
  const replayRequested = useTourStore(state => state.replayRequested);
  React.useEffect(() => {
    if (!replayRequested) { return; }
    useTourStore.getState().clear();
    originPath.current = pathname;
    setRecordsSeen(false);
    setIndex(0);
    setOpen(true);
  }, [replayRequested, pathname]);

  // Each stop opens the page it explains.
  React.useEffect(() => {
    if (open && pathname !== stop.path) { router.push(stop.path); }
  }, [open, stop.path, pathname, router]);

  const finish = React.useCallback(() => {
    setOpen(false);
    if (recordsSeen) {
      // Failing to record it must never reach the person: the tour may come back on a later visit.
      void markTourSeen().catch(() => undefined);
    }
    if (pathname !== originPath.current) { router.push(originPath.current); }
  }, [recordsSeen, pathname, router]);

  const goTo = React.useCallback((target: number) => {
    setIndex(Math.min(Math.max(target, 0), stops.length - 1));
  }, [stops.length]);

  // Focus: in on open, back where it was on close, Tab kept inside, Escape and the arrows on the keyboard.
  React.useEffect(() => {
    if (!open || !mounted) { return; }
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    return () => previouslyFocused.current?.focus();
  }, [open, mounted]);

  React.useEffect(() => {
    if (!open || !mounted) { return; }
    titleRef.current?.focus();
  }, [open, mounted, index]);

  React.useEffect(() => {
    if (!open || !mounted) { return; }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { finish(); return; }
      if (event.key === 'ArrowRight') { if (isLast) { return; } goTo(index + 1); return; }
      if (event.key === 'ArrowLeft') { goTo(index - 1); return; }
      if (event.key !== 'Tab' || !cardRef.current) { return; }

      const nodes = cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (nodes.length === 0) { return; }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, mounted, index, isLast, finish, goTo]);

  // Place the card beside the lifted zone, or centred when there is none.
  React.useLayoutEffect(() => {
    if (!open || !cardRef.current) { return; }
    const box = cardRef.current.getBoundingClientRect();
    setPosition(placeCard({
      anchor: rect,
      card: { width: box.width, height: box.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      side: stop.placement,
      bottomInset: smallScreen ? BOTTOM_INSET_SMALL : BOTTOM_INSET_DESKTOP,
    }));
  }, [open, rect, stop.placement, smallScreen, index]);

  if (!open || !mounted) { return null; }

  const lifted = rect !== null && hasZone;

  return createPortal(
    <div className="fixed inset-0 z-1000" data-testid="tour_overlay">
      <div
        aria-hidden="true"
        data-testid="tour_spotlight"
        data-lifted={lifted ? 'true' : 'false'}
        className={cn(
          'absolute rounded-card transition-[top,left,width,height] duration-(--duration-fast) ease-(--ease-smooth-out) motion-reduce:transition-none',
          lifted ? 'shadow-[0_0_0_9999px_var(--color-scrim)] ring-2 ring-surface-raised' : 'inset-0 rounded-none bg-scrim',
        )}
        style={lifted
          ? { top: rect.top - RING, left: rect.left - RING, width: rect.width + RING * 2, height: rect.height + RING * 2 }
          : undefined}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="tour_dialog"
        className="absolute w-[min(400px,calc(100vw-2rem))] rounded-card border border-border bg-surface-raised p-4 shadow-lg transition-[top,left] duration-(--duration-fast) ease-(--ease-smooth-out) motion-reduce:transition-none sm:p-6"
        style={position ?? { visibility: 'hidden' }}
      >
        <button
          type="button"
          onClick={finish}
          aria-label="Cerrar el recorrido"
          data-testid="tour_close_button"
          className="absolute right-3 top-3 grid size-11 place-items-center rounded-full text-tertiary hover:bg-surface focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <h3 id={titleId} ref={titleRef} tabIndex={-1} data-testid="tour_title" className="pr-10 text-h4 outline-hidden md:text-h3">{stop.title}</h3>
        <p data-testid="tour_body" className="mt-2 text-body-md text-text">{stop.body}</p>

        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {stops.map((candidate, position) => (
                <span
                  key={candidate.id}
                  className={cn('h-2 rounded-full transition-[width,background-color] duration-(--duration-fast) motion-reduce:transition-none', position === index ? 'w-[22px] bg-primary' : 'w-2 bg-accent-200')}
                />
              ))}
            </div>
            <span className="text-caption text-tertiary" aria-live="polite" data-testid="tour_progress">{`${index + 1} de ${stops.length}`}</span>
          </div>

          <div className="flex items-center gap-2">
            {!isLast && (
              <Button type="button" variant="ghost" size="sm" onClick={finish} data-testid="tour_skip_button">Saltar</Button>
            )}
            <span className="flex-1" />
            {index > 0 && (
              <Button type="button" variant="secondary" size="sm" onClick={() => goTo(index - 1)} data-testid="tour_back_button">Atrás</Button>
            )}
            <Button type="button" size="sm" onClick={() => (isLast ? finish() : goTo(index + 1))} data-testid="tour_next_button">
              {isLast ? 'Empezar' : 'Siguiente'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
