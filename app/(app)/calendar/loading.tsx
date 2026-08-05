'use client';

import { Skeleton } from 'boneyard-js/react';
import '@/bones/registry';

/** Route-level loading UI for `/calendar`. See `menu/loading.tsx` for the capture-page + per-file registry-import pattern. */
export default function CalendarLoading() {
  return <Skeleton name="calendar-page" loading>{null}</Skeleton>;
}
