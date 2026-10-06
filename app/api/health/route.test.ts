import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { GET } from './route';

afterEach(() => {
  spyOn(globalThis, 'fetch').mockRestore();
});

describe('GET /api/health (FRESCO-803)', () => {
  test('200 with ok when Supabase answers', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json() as { status: string }).status).toBe('ok');
  });

  test('503 with down when Supabase does not answer, so a monitor alerts on the status alone', async () => {
    spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json() as { checks: { supabase: string } }).checks.supabase).toBe('down');
  });
});
