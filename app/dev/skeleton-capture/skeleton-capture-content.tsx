'use client';

import { Skeleton } from 'boneyard-js/react';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { CalendarPageFixture, MenuPageFixture, RecipesPageFixture, ShoppingListPageFixture } from '@/lib/fixtures/page-shells';
import '@/bones/registry';

/**
 * `?loading=1` flips every `<Skeleton>` here to `loading` — a manual way to
 * eyeball what each real route's `loading.tsx` actually renders, without
 * racing a real (server-side, un-throttleable-from-the-browser) data fetch.
 */
function SkeletonCaptureInner() {
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

export function SkeletonCaptureContent() {
  return (
    <React.Suspense fallback={null}>
      <SkeletonCaptureInner />
    </React.Suspense>
  );
}
