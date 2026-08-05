'use client';

import { Skeleton } from 'boneyard-js/react';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { CalendarPageFixture, MenuPageFixture, RecipesPageFixture, ShoppingListPageFixture } from '@/lib/fixtures/page-shells';
import '@/bones/registry';

/**
 * Public, unauthenticated capture target for `npx boneyard-js build` — the
 * 4 real pages this app skeletons (`/menu`, `/recipes`, `/calendar`,
 * `/shopping-list`) all sit behind the `(app)` auth-gated route group, so
 * the CLI's crawler (an anonymous browser) never reaches them directly.
 * Same pattern as `/qa` (also public, also dev-tooling-only) — not linked
 * from any nav, reachable only by direct URL.
 *
 * Each `<Skeleton name="..." loading={false}>` here mounts the SAME name
 * used in the matching route's `loading.tsx`; boneyard captures bones by
 * name, not by URL, so it doesn't matter that the real pages live
 * elsewhere. Re-run `npx boneyard-js build http://localhost:3000/dev/skeleton-capture`
 * whenever one of the 4 real pages' layout changes.
 *
 * `?loading=1` flips every `<Skeleton>` here to `loading` — a manual way to
 * eyeball what each real route's `loading.tsx` actually renders, without
 * racing a real (server-side, un-throttleable-from-the-browser) data fetch.
 */
function SkeletonCaptureContent() {
  const loading = useSearchParams().get('loading') === '1';

  return (
    <div className="flex flex-col gap-12 bg-background p-8">
      <Skeleton name="menu-page" loading={loading}>
        <MenuPageFixture />
      </Skeleton>
      <Skeleton name="recipes-page" loading={loading}>
        <RecipesPageFixture />
      </Skeleton>
      <Skeleton name="calendar-page" loading={loading}>
        <CalendarPageFixture />
      </Skeleton>
      <Skeleton name="shopping-list-page" loading={loading}>
        <ShoppingListPageFixture />
      </Skeleton>
    </div>
  );
}

export default function SkeletonCapturePage() {
  return (
    <React.Suspense fallback={null}>
      <SkeletonCaptureContent />
    </React.Suspense>
  );
}
