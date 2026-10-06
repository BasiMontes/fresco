import * as React from 'react';
import { readCssDurationMs } from '@/components/ui/css-duration';

interface ShakingItem {
  pasilloIdx: number
  itemIdx: number
  nonce: number
}

/**
 * FRESCO-248 — AC-3: which single row shakes on a failed toggle (error
 * state shake, `transitions-dev`'s `12-error-state-shake.md`). Holds only
 * the most recent failing coordinate. `nonce` forces the shaking wrapper to
 * remount (via `key`) so a second failure on the SAME item replays the
 * animation: without it, the derived className string is identical across
 * both renders, React skips the DOM write, and the CSS animation never
 * restarts (caught in code review).
 */
export function useShakeItem() {
  const [shakingItem, setShakingItem] = React.useState<ShakingItem | null>(null);
  const shakeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (shakeTimerRef.current) { clearTimeout(shakeTimerRef.current); }
  }, []);

  function triggerShake({ pasilloIdx, itemIdx }: { pasilloIdx: number, itemIdx: number }) {
    if (shakeTimerRef.current) {
      clearTimeout(shakeTimerRef.current);
    }
    setShakingItem(current => ({ pasilloIdx, itemIdx, nonce: (current?.nonce ?? 0) + 1 }));
    const shakeMs = readCssDurationMs('--shake-dur-a', 80) * 2 + readCssDurationMs('--shake-dur-b', 60) * 2;
    shakeTimerRef.current = setTimeout(setShakingItem, shakeMs + 20, null);
  }

  return { shakingItem, triggerShake };
}
