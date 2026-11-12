import { describe, expect, spyOn, test } from 'bun:test';
import { recordConsents, sendSeedRequest } from './test-helpers';
import { buildProfileRow, deleteTrackedUsers } from './test-user-factory';

/**
 * FRESCO-1197: a profile created now starts as "not seen" and the first-visit tour would open over every
 * scenario, so the factory seeds the account as having seen it, unless a scenario asks for the tour.
 */
describe('buildProfileRow', () => {
  test('marks the tour as seen by default, so its overlay does not cover the screen under test', () => {
    expect(buildProfileRow('user-1', false)).toEqual({ id: 'user-1', recorrido_visto: true });
  });

  test('leaves the profile as the app creates it when the scenario wants the tour', () => {
    expect(buildProfileRow('user-1', true)).toEqual({ id: 'user-1' });
  });
});

/**
 * FRESCO-1136: a 502 from the gateway of the local Supabase stack ("An invalid response was received from
 * the upstream server") used to fail the whole scenario while seeding; it is now retried, but only a 5xx.
 */
describe('sendSeedRequest', () => {
  const answer = (status: number) => ({ ok: () => status >= 200 && status < 300, status: () => status });
  const noWait = async () => {};

  test('returns the first answer untouched when it is fine, without retrying or waiting', async () => {
    const waits: number[] = [];
    let calls = 0;

    const { res, retried } = await sendSeedRequest(async () => { calls++; return answer(201); }, async (ms) => { waits.push(ms); });

    expect(res.status()).toBe(201);
    expect(retried).toBe(false);
    expect(calls).toBe(1);
    expect(waits).toEqual([]);
  });

  test('retries a 502 with a growing pause and returns the first good answer', async () => {
    const waits: number[] = [];
    const statuses = [502, 502, 201];
    let calls = 0;

    const { res, retried } = await sendSeedRequest(async () => answer(statuses[calls++]), async (ms) => { waits.push(ms); });

    expect(res.ok()).toBe(true);
    expect(retried).toBe(true);
    expect(calls).toBe(3);
    expect(waits).toEqual([400, 800]);
  });

  test('gives up after three attempts and returns the last 5xx so the caller can report it', async () => {
    let calls = 0;

    const { res, retried } = await sendSeedRequest(async () => { calls++; return answer(502); }, noWait);

    expect(calls).toBe(3);
    expect(res.status()).toBe(502);
    expect(retried).toBe(true);
  });

  test('a 4xx is a real answer: returned at once, never retried', async () => {
    for (const status of [400, 403, 409, 422]) {
      let calls = 0;
      const { res, retried } = await sendSeedRequest(async () => { calls++; return answer(status); }, noWait);
      expect(calls).toBe(1);
      expect(res.status()).toBe(status);
      expect(retried).toBe(false);
    }
  });

  test('a 409 after a retried 5xx is flagged, because the first attempt may have been committed', async () => {
    const statuses = [502, 409];
    let calls = 0;

    const { res, retried } = await sendSeedRequest(async () => answer(statuses[calls++]), noWait);

    expect(res.status()).toBe(409);
    expect(retried).toBe(true);
  });
});

/** FRESCO-1016 (A7-TEST-09): a failed cleanup is reported, not swallowed, and never stops the others. */
describe('deleteTrackedUsers', () => {
  test('deletes every id and reports none failed when all go well', async () => {
    const deleted: string[] = [];

    const failed = await deleteTrackedUsers(['a', 'b', 'c'], async (id) => { deleted.push(id); });

    expect(failed).toEqual([]);
    expect(deleted.sort()).toEqual(['a', 'b', 'c']);
  });

  test('one failure does not stop the rest, and the failed id comes back', async () => {
    const deleted: string[] = [];
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const failed = await deleteTrackedUsers(['a', 'b', 'c'], async (id) => {
        if (id === 'b') { throw new Error('403 forbidden'); }
        deleted.push(id);
      });

      expect(failed).toEqual(['b']);
      expect(deleted.sort()).toEqual(['a', 'c']);
    }
    finally {
      spy.mockRestore();
    }
  });

  test('each failure is annotated for the run page with the id and the reason', async () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      await deleteTrackedUsers(['x'], async () => { throw new Error('boom'); });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][0])).toContain('::error::');
      expect(String(spy.mock.calls[0][0])).toContain('x');
      expect(String(spy.mock.calls[0][0])).toContain('boom');
    }
    finally {
      spy.mockRestore();
    }
  });
});

/**
 * FRESCO-1148: `recordConsents` seeds the consents of every factory user, and a 502 from the gateway on that
 * one write failed the scenario (the gap #916 left when it retried the other seeding writes).
 */
describe('recordConsents', () => {
  const realFetch = globalThis.fetch;
  const previousEnv = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };

  function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[name];
    }
    else {
      process.env[name] = value;
    }
  }

  function stubFetch(statuses: number[]) {
    let calls = 0;
    globalThis.fetch = (async () => {
      const status = statuses[calls++];
      return new Response(status === 200 ? 'null' : 'bad gateway', { status });
    }) as unknown as typeof fetch;
    return { calls: () => calls };
  }

  function setup(statuses: number[]) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://seed.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
    return stubFetch(statuses);
  }

  function restore() {
    globalThis.fetch = realFetch;
    restoreEnv('NEXT_PUBLIC_SUPABASE_URL', previousEnv.url);
    restoreEnv('SUPABASE_SERVICE_ROLE_KEY', previousEnv.key);
  }

  test('writes once when the first answer is fine', async () => {
    const stub = setup([200]);
    try {
      await recordConsents('user-1', ['terms']);
      expect(stub.calls()).toBe(1);
    }
    finally { restore(); }
  });

  test('retries a 502 and succeeds on the next answer', async () => {
    const stub = setup([502, 200]);
    try {
      await recordConsents('user-1', ['terms']);
      expect(stub.calls()).toBe(2);
    }
    finally { restore(); }
  });

  test('gives up after three attempts and reports the last status and body', async () => {
    const stub = setup([502, 502, 502]);
    try {
      await expect(recordConsents('user-1', ['terms', 'privacy'])).rejects.toThrow('record_consents(terms,privacy) failed: 502 bad gateway');
      expect(stub.calls()).toBe(3);
    }
    finally { restore(); }
  });

  test('does not retry a 4xx, it is a real answer', async () => {
    const stub = setup([400]);
    try {
      await expect(recordConsents('user-1', ['terms'])).rejects.toThrow('failed: 400');
      expect(stub.calls()).toBe(1);
    }
    finally { restore(); }
  });
});
