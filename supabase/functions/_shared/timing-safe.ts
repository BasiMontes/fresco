/**
 * FRESCO-816 (audit-6 A6-S8): compares two secrets without stopping at the first
 * differing byte, so the response time does not tell a caller how much of a guess
 * was right. Always walks the longer of the two, so it leaks only that the lengths
 * differ, never where the values diverge.
 *
 * Pure TypeScript on purpose: the Edge runtime and `bun test` both run it, and a
 * Node-only `crypto` import would break one of them.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const left = encoder.encode(a)
  const right = encoder.encode(b)

  let difference = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return difference === 0
}
