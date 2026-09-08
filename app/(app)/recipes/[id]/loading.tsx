'use client';

import { Skeleton } from 'boneyard-js/react';
import '@/bones/registry';

/** Route-level loading UI for `/recipes/[id]`. See `menu/loading.tsx` for the capture-page + per-file registry-import pattern. */
export default function RecipeDetailLoading() {
  return <Skeleton name="recipe-detail-page" loading>{null}</Skeleton>;
}
