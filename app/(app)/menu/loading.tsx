'use client';

import { Skeleton } from 'boneyard-js/react';
import '@/bones/registry';

/**
 * Next.js route-level loading UI — shown automatically while `page.tsx`
 * (an async Server Component) fetches. Bones for `name="menu-page"` are
 * captured from `app/dev/skeleton-capture/page.tsx` (this real page sits
 * behind auth, so the CLI can't crawl it directly).
 *
 * The registry import is REQUIRED in this exact file, not just once
 * somewhere global (e.g. the root layout) — confirmed live: Next.js gives
 * each 'use client' entry point its own bundle under Turbopack, and
 * boneyard-js's bone registry is a plain in-memory `Map`, so a registration
 * from one bundle's copy of the module never reaches another's. See
 * `app/layout.tsx`'s comment for the full story.
 */
export default function MenuLoading() {
  return <Skeleton name="menu-page" loading>{null}</Skeleton>;
}
