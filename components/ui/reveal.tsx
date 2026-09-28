'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: ReactNode
  className?: string
  /** Viewport intersection ratio that triggers the reveal. Default 0.15. */
  threshold?: number
}

/**
 * FRESCO-446 — scroll reveal for landing sections (epic FRESCO-436, tarjeta 8).
 *
 * Wraps a section in a `<div data-reveal>` that starts shifted + transparent
 * and settles once it scrolls into view. The motion itself is the
 * `[data-reveal]` rule in `app/globals.css`, gated by
 * `@media (prefers-reduced-motion: no-preference)` and reusing the existing
 * `--duration-slow` / `--distance-medium` / `--ease-smooth-out` tokens
 * (transitions-dev / FRESCO-247) — no new motion tokens, no spring.
 *
 * `data-reveal` is only applied AFTER mount, so the server-rendered HTML (and
 * a JS-disabled client) shows every section fully visible — the landing is the
 * acquisition funnel and must not depend on client JS to render its content.
 *
 * `IntersectionObserver` drives the normal downward-scroll reveal. A `scroll`
 * fallback covers the case IO cannot: an anchor jump from the nav (`#pricing`,
 * `#faq`) moves a section straight from below the fold to above it without
 * crossing a threshold, so IO never fires — the fallback reveals any section
 * whose top edge has risen past the 85%-of-viewport-height line (i.e. the
 * section is at least mostly on screen, or already scrolled past). Both are
 * removed once the section is revealed.
 */
export function Reveal({ children, className, threshold = 0.15 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setMounted(true);

    const el = ref.current;
    if (!el) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    const canListen
      = typeof window !== 'undefined' && typeof window.addEventListener === 'function';

    let done = false;
    let cleanup = () => {};

    const reveal = () => {
      if (done) {
        return;
      }
      done = true;
      setRevealed(true);
      cleanup();
    };

    // FRESCO-721 — `getBoundingClientRect()` is a layout read. Calling it
    // synchronously (at mount, or straight inside the `scroll` handler) risks
    // a forced reflow if any DOM write from another effect landed earlier in
    // the same task and hasn't been flushed to layout yet. Scheduling the
    // read for the next animation frame lets the browser's own rendering
    // pipeline settle layout first, so the read is never the thing forcing it.
    let rafId: number | null = null;
    const checkScroll = () => {
      rafId = null;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.85) {
        reveal();
      }
    };
    const onScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(checkScroll);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(entry => entry.isIntersecting)) {
          reveal();
        }
      },
      { threshold },
    );

    cleanup = () => {
      observer.disconnect();
      if (canListen) {
        window.removeEventListener('scroll', onScroll);
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };

    observer.observe(el);
    if (canListen) {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    return cleanup;
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={className}
      data-reveal={mounted ? '' : undefined}
      data-revealed={revealed ? '' : undefined}
    >
      {children}
    </div>
  );
}
