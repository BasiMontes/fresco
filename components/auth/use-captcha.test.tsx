import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'bun:test';
import { useCaptcha } from '@/components/auth/use-captcha';

/** FRESCO-944 — the verification state the widget reports and the form reads. */

describe('useCaptcha', () => {
  test('without a site key there is nothing to wait for', () => {
    const { result } = renderHook(() => useCaptcha(false));

    expect(result.current.enabled).toBe(false);
    expect(result.current.ready).toBe(true);
  });

  test('with a site key the form waits, and the check starts as verifying', () => {
    const { result } = renderHook(() => useCaptcha(true));

    expect(result.current.ready).toBe(false);
    expect(result.current.status).toBe('verifying');
    expect(result.current.token).toBeNull();
  });

  test('a token makes it ready and marks the check as passed', () => {
    const { result } = renderHook(() => useCaptcha(true));

    act(() => result.current.setToken('tok'));

    expect(result.current.ready).toBe(true);
    expect(result.current.status).toBe('passed');
  });

  test.each(['failed', 'expired', 'challenge'] as const)('%s is reported without a token and keeps the form waiting', (status) => {
    const { result } = renderHook(() => useCaptcha(true));

    act(() => {
      result.current.setToken(null);
      result.current.setStatus(status);
    });

    expect(result.current.status).toBe(status);
    expect(result.current.ready).toBe(false);
  });

  test('clearing the token does not by itself undo a passed status: the widget says why', () => {
    const { result } = renderHook(() => useCaptcha(true));
    act(() => result.current.setToken('tok'));

    act(() => {
      result.current.setToken(null);
      result.current.setStatus('expired');
    });

    expect(result.current.ready).toBe(false);
    expect(result.current.status).toBe('expired');
  });

  test('reset drops the token, goes back to verifying and asks the widget for a new challenge', () => {
    const { result } = renderHook(() => useCaptcha(true));
    act(() => result.current.setToken('tok'));
    const before = result.current.resetKey;

    act(() => result.current.reset());

    expect(result.current.token).toBeNull();
    expect(result.current.status).toBe('verifying');
    expect(result.current.resetKey).toBe(before + 1);
  });
});
