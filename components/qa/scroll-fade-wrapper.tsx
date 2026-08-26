'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ScrollFadeWrapperProps {
  html: string
  className?: string
}

/**
 * FRESCO-268 — ports the right-edge scroll-hint gradient shipped for
 * `calendar-grid.tsx` (FRESCO-184) to `/qa`'s code blocks: same
 * scroll + ResizeObserver tracking, gradient shown only while there's
 * more to scroll (a viewport resize alone can flip whether the content
 * overflows at all, so scroll events alone aren't enough).
 */
export function ScrollFadeWrapper({ html, className }: ScrollFadeWrapperProps) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const updateCanScrollRight = () => {
      // 1px buffer for sub-pixel rounding at the exact scrolled-to-end position.
      setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
    };

    updateCanScrollRight();
    scroller.addEventListener('scroll', updateCanScrollRight, { passive: true });
    const resizeObserver = new ResizeObserver(updateCanScrollRight);
    resizeObserver.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', updateCanScrollRight);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      {canScrollRight && (
        <div
          aria-hidden="true"
          data-testid="qa_code_block_scroll_hint"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-surface to-transparent"
        />
      )}
      <div
        ref={scrollerRef}
        data-testid="qa_code_block"
        className={cn('overflow-x-auto p-3 text-body-sm [&_pre]:!bg-transparent', className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
