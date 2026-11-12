'use client';

import type { TourRect } from '@/lib/tour/place-card';
import { useEffect, useState } from 'react';

/** About a second and a half at 60 fps: enough for a page to mount after `router.push`, then give up. */
const MAX_FRAMES = 90;

/**
 * FRESCO-1197: finds the zone of a tour stop (`data-tour="<anchor>"`), scrolls it into view and keeps its
 * box up to date while the stop is shown. The zone may not exist yet: the tour opens the page of the stop
 * and the page mounts a moment later, so the lookup retries on each frame for a short while. A zone that
 * never appears leaves `null`, and the tour centres its card over the dimmed page instead.
 */
export function useTourAnchor(anchor: string | null): TourRect | null {
  const [rect, setRect] = useState<TourRect | null>(null);

  useEffect(() => {
    setRect(null);
    if (!anchor) { return; }

    let frame = 0;
    let attempts = 0;
    let observer: ResizeObserver | undefined;
    let element: Element | null = null;

    function measure() {
      if (!element) { return; }
      const box = element.getBoundingClientRect();
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    }

    function find() {
      element = document.querySelector(`[data-tour="${anchor}"]`);

      if (!element) {
        if (attempts++ < MAX_FRAMES) { frame = requestAnimationFrame(find); }
        return;
      }

      element.scrollIntoView?.({ block: 'center', behavior: 'instant' });
      measure();
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(measure);
        observer.observe(element);
      }
    }

    find();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchor]);

  return rect;
}
