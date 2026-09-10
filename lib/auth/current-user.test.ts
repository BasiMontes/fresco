import { beforeEach, describe, expect, mock, test } from 'bun:test';

/**
 * FRESCO-483. `getAuthUser()` is a thin `React.cache()` wrapper over
 * `createClient().auth.getUser()`. The per-render dedup it exists for only
 * happens inside a React render context, so it can't be exercised here — the
 * e2e suite + the story's before/after measurement cover that. What a unit
 * test can lock: it delegates to `auth.getUser()` and returns its result
 * verbatim, so a future refactor can't quietly change the shape callers
 * destructure (`{ data: { user }, error }`).
 */

const getUserResult = { data: { user: { id: 'user_1', is_anonymous: false } }, error: null };
const getUserMock = mock(async () => getUserResult);

void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));

const { getAuthUser } = await import('./current-user');

beforeEach(() => {
  getUserMock.mockClear();
});

describe('getAuthUser', () => {
  test('returns the auth.getUser() result verbatim', async () => {
    const result = await getAuthUser();
    expect(result).toBe(getUserResult);
    expect(result.data.user?.id).toBe('user_1');
  });

  test('delegates to auth.getUser()', async () => {
    await getAuthUser();
    expect(getUserMock).toHaveBeenCalled();
  });
});
