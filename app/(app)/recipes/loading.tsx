'use client';

import { Skeleton } from 'boneyard-js/react';
import '@/bones/registry';

/** Route-level loading UI for `/recipes`. See `menu/loading.tsx` for the capture-page + per-file registry-import pattern. */
export default function RecipesLoading() {
  return <Skeleton name="recipes-page" loading>{null}</Skeleton>;
}
