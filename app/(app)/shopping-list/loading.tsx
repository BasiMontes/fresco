'use client';

import { Skeleton } from 'boneyard-js/react';
import '@/bones/registry';

/** Route-level loading UI for `/shopping-list`. See `menu/loading.tsx` for the capture-page + per-file registry-import pattern. */
export default function ShoppingListLoading() {
  return <Skeleton name="shopping-list-page" loading>{null}</Skeleton>;
}
