'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';

/**
 * FRESCO-372 (A4-H15): closes the loop `public/sw.js` opens — a click on
 * the weekly re-engagement notification appends `?push_opened=1` to `/menu`
 * before focusing/opening the tab. This effect fires the `push_opened`
 * event once, then strips the query param via `router.replace` (no
 * history entry, no visible flash) so a page reload never double-counts.
 *
 * Deliberately its own tiny client component rather than logic inlined in
 * `page.tsx` (a Server Component) — `useSearchParams` needs the client
 * boundary, and keeping it separate means the rest of `/menu` stays server
 * data-fetching only.
 */
export function PushOpenedTracker() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('push_opened') !== '1') {
      return;
    }
    captureEvent(POSTHOG_EVENTS.PUSH_OPENED);
    const next = new URLSearchParams(searchParams);
    next.delete('push_opened');
    const query = next.toString();
    router.replace(query ? `/menu?${query}` : '/menu');
    // Runs once per mount with the param present — searchParams itself
    // changes as a result of this effect's own router.replace, so it must
    // not be a dependency (would loop).
  }, []);

  return null;
}
