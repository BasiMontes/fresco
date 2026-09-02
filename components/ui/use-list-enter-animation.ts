'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';

/**
 * FRESCO-246 — enter animation for list / grid items.
 *
 * `getItemProps(key, index)` spreads onto each item element:
 * - **first render**: every key is treated as initial and gets a staggered
 *   enter (AC scenario 3 — a list of >6 items enters ~`--duration-stagger`
 *   apart), capped at {@link STAGGER_CAP} so a long list's tail is not held
 *   back.
 * - **later renders**: only keys not seen before enter, with no stagger delay
 *   (AC scenario 1 — a single card added to an existing list just fades in).
 *   Keys already seen get no props, so React reusing a node never replays the
 *   animation.
 *
 * The animation itself is the `[data-list-enter]` rule in `app/globals.css`,
 * gated by `@media (prefers-reduced-motion: no-preference)` — under reduced
 * motion the rule is absent and items appear instantly (AC scenario 4).
 *
 * Assumes the list has its items on the first client render (the consumers are
 * server-rendered with their data as props). A list that starts empty and
 * fills in asynchronously would not get the initial stagger — acceptable for
 * the current consumers.
 */

const STAGGER_CAP = 8;

export interface ListEnterItemProps {
  'data-list-enter'?: ''
  'style'?: CSSProperties
}

export function useListEnterAnimation(): (key: string, index: number) => ListEnterItemProps {
  const seenRef = useRef<Set<string>>(new Set());
  const firstRenderRef = useRef(true);

  const isFirstRender = firstRenderRef.current;
  const newThisRender = new Set<string>();

  useEffect(() => {
    for (const key of newThisRender) {
      seenRef.current.add(key);
    }
    firstRenderRef.current = false;
  });

  return (key, index) => {
    if (seenRef.current.has(key) || newThisRender.has(key)) {
      return {};
    }
    newThisRender.add(key);
    return {
      'data-list-enter': '',
      'style': { '--enter-index': isFirstRender ? Math.min(index, STAGGER_CAP) : 0 } as CSSProperties,
    };
  };
}
