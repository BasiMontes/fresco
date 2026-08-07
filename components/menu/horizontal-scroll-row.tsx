'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * FRESCO-78 — a horizontally-scrolling row (e.g. `LatestRecipesSection`)
 * gives no visual hint that there's more content past the edge. Wraps the
 * scroll container with left/right arrow buttons that scroll by roughly
 * one card width and hide themselves at each end, so a user never sees a
 * "back" arrow with nothing behind it or a "forward" arrow with nothing
 * ahead.
 */
export function HorizontalScrollRow({ children, className }: { children: React.ReactNode, className?: string }) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateArrows = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) { return; }
    setCanScrollLeft(el.scrollLeft > 0);
    // 1px tolerance — sub-pixel layout can leave scrollLeft a fraction short
    // of the true max, which would otherwise strand the right arrow visible
    // forever at the actual end of scroll.
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  React.useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) { return; }
    const resizeObserver = new ResizeObserver(updateArrows);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [updateArrows]);

  function scrollByCard(direction: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: direction * 272, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Ver recetas anteriores"
          onClick={() => scrollByCard(-1)}
          className={cn(buttonVariants({ variant: 'icon', size: 'sm' }), 'absolute -left-2 top-1/2 z-10 -translate-y-1/2 shadow-md')}
        >
          <ChevronLeft className="size-[22px]" />
        </button>
      )}
      <div
        ref={scrollerRef}
        onScroll={updateArrows}
        className={cn('flex gap-4 overflow-x-auto pb-2', className)}
      >
        {children}
      </div>
      {canScrollRight && (
        <button
          type="button"
          aria-label="Ver recetas siguientes"
          onClick={() => scrollByCard(1)}
          className={cn(buttonVariants({ variant: 'icon', size: 'sm' }), 'absolute -right-2 top-1/2 z-10 -translate-y-1/2 shadow-md')}
        >
          <ChevronRight className="size-[22px]" />
        </button>
      )}
    </div>
  );
}
