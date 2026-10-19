import { describe, expect, mock, test } from 'bun:test';
import { LEGAL_TEXTS_VERSION } from './consent';
import { confirmWaitlistSignup, hashWaitlistToken, isWaitlistToken, newWaitlistToken, parseWaitlistBody, removeWaitlistSignup, requestWaitlistSignup, withinIpLimit } from './waitlist';

describe('parseWaitlistBody', () => {
  test('accepts an email with explicit consent and trims it', () => {
    expect(parseWaitlistBody({ email: '  ana@example.com ', consent: true })).toEqual({ email: 'ana@example.com' });
  });

  test('rejects a missing or non-true consent', () => {
    expect(parseWaitlistBody({ email: 'ana@example.com' })).toBeNull();
    expect(parseWaitlistBody({ email: 'ana@example.com', consent: 'true' })).toBeNull();
    expect(parseWaitlistBody({ email: 'ana@example.com', consent: false })).toBeNull();
  });

  test('rejects malformed emails and non-objects', () => {
    for (const email of ['', 'ana', 'ana@', '@example.com', 'a b@example.com', `${'a'.repeat(250)}@example.com`, 42]) {
      expect(parseWaitlistBody({ email, consent: true })).toBeNull();
    }
    expect(parseWaitlistBody(null)).toBeNull();
    expect(parseWaitlistBody('ana@example.com')).toBeNull();
  });
});

describe('waitlist tokens', () => {
  test('a new token is URL-safe, 43 characters and different every time', () => {
    const a = newWaitlistToken();
    expect(isWaitlistToken(a)).toBe(true);
    expect(a).not.toBe(newWaitlistToken());
  });

  test('only the shape of a token passes isWaitlistToken', () => {
    for (const value of ['', 'short', `${'a'.repeat(42)}!`, 'a'.repeat(44), 42, null, undefined]) {
      expect(isWaitlistToken(value)).toBe(false);
    }
  });

  test('the stored hash is the SHA-256 hex of the token, never the token', () => {
    const token = newWaitlistToken();
    const hash = hashWaitlistToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });
});

function rpcClient(result: { data: unknown, error: unknown }) {
  const rpc = mock(async (_name: string, _args: Record<string, unknown>) => result);
  return { client: { rpc } as never, rpc };
}

describe('requestWaitlistSignup', () => {
  test('sends the server version and the HASH of the token, and returns the token to mail', async () => {
    const { client, rpc } = rpcClient({ data: 'send', error: null });

    const result = await requestWaitlistSignup(client, 'ana@example.com');

    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as [string, { p_email: string, p_version: string, p_token_hash: string }];
    expect(name).toBe('request_waitlist_signup');
    expect(args.p_email).toBe('ana@example.com');
    expect(args.p_version).toBe(LEGAL_TEXTS_VERSION);
    expect(result.outcome).toBe('send');
    expect(result.token).not.toBeNull();
    expect(args.p_token_hash).toBe(hashWaitlistToken(result.token!));
  });

  test.each(['throttled', 'confirmed'])('%s means nothing to send: no token comes back', async (outcome) => {
    const { client } = rpcClient({ data: outcome, error: null });

    expect(await requestWaitlistSignup(client, 'ana@example.com')).toEqual({ error: null, outcome, token: null });
  });

  test('a database error is returned with no token', async () => {
    const { client } = rpcClient({ data: null, error: { code: '42501' } });

    expect(await requestWaitlistSignup(client, 'ana@example.com')).toEqual({ error: { code: '42501' }, outcome: null, token: null });
  });
});

describe('confirmWaitlistSignup / removeWaitlistSignup', () => {
  test('look the signup up by the hash of the token', async () => {
    const token = newWaitlistToken();
    const confirm = rpcClient({ data: true, error: null });
    const remove = rpcClient({ data: false, error: null });

    expect(await confirmWaitlistSignup(confirm.client, token)).toEqual({ error: null, found: true });
    expect(await removeWaitlistSignup(remove.client, token)).toEqual({ error: null, found: false });
    expect(confirm.rpc).toHaveBeenCalledWith('confirm_waitlist_signup', { p_token_hash: hashWaitlistToken(token) });
    expect(remove.rpc).toHaveBeenCalledWith('remove_waitlist_signup', { p_token_hash: hashWaitlistToken(token) });
  });
});

describe('withinIpLimit', () => {
  test('keys the limit on a hash of the first forwarded address, never the address', async () => {
    const { client, rpc } = rpcClient({ data: true, error: null });

    const result = await withinIpLimit(client, { headers: new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), endpoint: 'waitlist-signup', limit: 5 });

    expect(result.allowed).toBe(true);
    const [name, args] = rpc.mock.calls[0] as [string, { p_key_hash: string, p_endpoint: string, p_limit: number }];
    expect(name).toBe('check_ip_rate_limit');
    expect(args.p_key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain('203.0.113.7');
    expect(args.p_limit).toBe(5);
  });

  test('the same address on another endpoint gets another key', async () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7' });
    const a = rpcClient({ data: true, error: null });
    const b = rpcClient({ data: true, error: null });

    await withinIpLimit(a.client, { headers, endpoint: 'waitlist-signup', limit: 5 });
    await withinIpLimit(b.client, { headers, endpoint: 'waitlist-confirm', limit: 5 });

    expect((a.rpc.mock.calls[0] as unknown[])[1]).not.toEqual((b.rpc.mock.calls[0] as unknown[])[1]);
  });

  test('a refused call is not allowed', async () => {
    const { client } = rpcClient({ data: false, error: null });

    expect((await withinIpLimit(client, { headers: new Headers(), endpoint: 'waitlist-signup', limit: 5 })).allowed).toBe(false);
  });
});
