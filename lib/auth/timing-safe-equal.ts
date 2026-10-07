import { createHash, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';

/**
 * FRESCO-816 (audit-6 A6-S8): compares two secrets without leaking, through the
 * response time, how much of a guess was right.
 *
 * `node:crypto`'s `timingSafeEqual` throws when the buffers differ in length, which
 * would itself tell a caller the length. Hashing both sides first gives equal-length
 * digests, so the comparison is constant-time whatever the inputs.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return nodeTimingSafeEqual(left, right);
}
