import { describe, expect, test } from 'bun:test';
import { resolveStackReachable } from './harness';

/**
 * FRESCO-781 (audit-6 A6-T3) — the DB-integration suite must fail CLOSED.
 * Every `tests/db/*.test.ts` guards its `describe` with `skipIf(!(RUN && reachable))`,
 * so a stack that does not answer used to skip all 138 tests and let the CI job
 * go green (`0 pass / 117 skip`, exit 0) — exactly the net that closed the
 * audit-4 and audit-5 BLOCKERs. These tests pin the policy without needing a
 * stack: the probe and the sleep are injected.
 */

const noSleep = async () => {};

function probeThat(...answers: boolean[]) {
  let calls = 0;
  const probe = async () => answers[Math.min(calls++, answers.length - 1)];
  return { probe, calls: () => calls };
}

describe('resolveStackReachable', () => {
  test('returns true on the first answer without waiting', async () => {
    const p = probeThat(true);
    expect(await resolveStackReachable({ required: true, probe: p.probe, sleep: noSleep })).toBe(true);
    expect(p.calls()).toBe(1);
  });

  test('retries a stack that is still starting and succeeds once it answers', async () => {
    const p = probeThat(false, false, true);
    expect(await resolveStackReachable({ required: true, attempts: 5, probe: p.probe, sleep: noSleep })).toBe(true);
    expect(p.calls()).toBe(3);
  });

  test('when the suite is REQUIRED and the stack never answers it throws instead of skipping', async () => {
    const p = probeThat(false);
    await expect(resolveStackReachable({ required: true, attempts: 4, probe: p.probe, sleep: noSleep }))
      .rejects
      .toThrow(/refusing to skip/i);
    expect(p.calls()).toBe(4);
  });

  test('when the suite is not required an unreachable stack just reports false', async () => {
    const p = probeThat(false);
    expect(await resolveStackReachable({ required: false, attempts: 2, probe: p.probe, sleep: noSleep })).toBe(false);
  });

  test('waits between attempts but not after the last one', async () => {
    const sleeps: number[] = [];
    const p = probeThat(false);
    await resolveStackReachable({
      required: false,
      attempts: 3,
      delayMs: 1234,
      probe: p.probe,
      sleep: async (ms) => { sleeps.push(ms); },
    });
    expect(sleeps).toEqual([1234, 1234]);
  });
});
