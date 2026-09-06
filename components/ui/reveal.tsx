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
 * whose top edge has reached the lower 85% of the viewport. Both are removed
 * once the section is revealed.
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

    const onScroll = () => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.85) {
        reveal();
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
