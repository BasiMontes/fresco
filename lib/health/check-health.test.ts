import { describe, expect, test } from 'bun:test';
import { checkHealth } from './check-health';

const base = { supabaseUrl: 'https://proj.supabase.co/', anonKey: 'anon-key-for-tests' };

function respond(status: number): typeof fetch {
  return (async () => new Response('[]', { status })) as unknown as typeof fetch;
}

describe('checkHealth (FRESCO-803)', () => {
  test('is ok when Supabase answers a read', async () => {
    const report = await checkHealth({ ...base, fetchImpl: respond(200), commitSha: 'abcdef1234567890', environment: 'production' });
    expect(report).toEqual({ status: 'ok', commit: 'abcdef1', environment: 'production', checks: { app: 'ok', supabase: 'ok' } });
  });

  test('is down when Supabase answers an error status', async () => {
    const report = await checkHealth({ ...base, fetchImpl: respond(503) });
    expect(report.status).toBe('down');
    expect(report.checks).toEqual({ app: 'ok', supabase: 'down' });
  });

  test('is down when the request fails or times out', async () => {
    const boom = (async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    expect((await checkHealth({ ...base, fetchImpl: boom })).status).toBe('down');

    const slow = (async (_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;
    expect((await checkHealth({ ...base, fetchImpl: slow, timeoutMs: 20 })).status).toBe('down');
  });

  test('reads one row of the public catalog with the anon key and no double slash', async () => {
    let seen: { url: string, headers: Record<string, string> } | undefined;
    const spy = (async (url: string, init?: RequestInit) => {
      seen = { url, headers: init?.headers as Record<string, string> };
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    await checkHealth({ ...base, fetchImpl: spy });
    expect(seen?.url).toBe('https://proj.supabase.co/rest/v1/recipes?select=id&limit=1');
    expect(seen?.headers.apikey).toBe(base.anonKey);
  });

  test('never puts a URL, key or error message in the report', async () => {
    const boom = (async () => { throw new Error('secret detail https://proj.supabase.co'); }) as unknown as typeof fetch;
    const text = JSON.stringify(await checkHealth({ ...base, fetchImpl: boom }));
    expect(text).not.toContain('supabase.co');
    expect(text).not.toContain(base.anonKey);
    expect(text).not.toContain('secret detail');
  });

  test('has no commit outside Vercel', async () => {
    expect((await checkHealth({ ...base, fetchImpl: respond(200) })).commit).toBeNull();
  });
});
