import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import * as guestMenuApi from '@/lib/client-api/guest-menu';
import { renderHook, waitFor } from '@/tests/component-render';
import { useGuestMenu } from './use-guest-menu';

// FRESCO-1173 — the "keep your menu" copy shows only when the check says the visitor is a guest with a menu.

describe('useGuestMenu', () => {
  let spy: ReturnType<typeof spyOn<typeof guestMenuApi, 'guestHasMenu'>>;
  afterEach(() => spy.mockRestore());

  test('is false until the check ends, then true for a guest with a menu', async () => {
    spy = spyOn(guestMenuApi, 'guestHasMenu').mockResolvedValue(true);
    const { result } = renderHook(() => useGuestMenu());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  test('stays false when the visitor has no menu', async () => {
    spy = spyOn(guestMenuApi, 'guestHasMenu').mockResolvedValue(false);
    const { result } = renderHook(() => useGuestMenu());
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  test('stays false when the check fails', async () => {
    spy = spyOn(guestMenuApi, 'guestHasMenu').mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useGuestMenu());
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
