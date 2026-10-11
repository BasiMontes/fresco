import { describe, expect, mock, test } from 'bun:test';
import { LEGAL_TEXTS_VERSION } from './consent';
import { addToWaitlist, parseWaitlistBody } from './waitlist';

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

describe('addToWaitlist', () => {
  function clientReturning(error: { code: string } | null) {
    const insert = mock(async () => ({ error }));
    const from = mock(() => ({ insert }));
    return { client: { from } as never, from, insert };
  }

  test('inserts the email with the server-side consent version', async () => {
    const { client, from, insert } = clientReturning(null);

    expect(await addToWaitlist(client, 'ana@example.com')).toEqual({ error: null });
    expect(from).toHaveBeenCalledWith('waitlist_signups');
    expect(insert).toHaveBeenCalledWith({ email: 'ana@example.com', consent_version: LEGAL_TEXTS_VERSION });
  });

  test('an address already on the list is a success', async () => {
    const { client } = clientReturning({ code: '23505' });

    expect(await addToWaitlist(client, 'ana@example.com')).toEqual({ error: null });
  });

  test('any other database error is returned', async () => {
    const { client } = clientReturning({ code: '42501' });

    expect((await addToWaitlist(client, 'ana@example.com')).error).toEqual({ code: '42501' });
  });
});
