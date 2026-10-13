'use client';

import { useCallback, useState } from 'react';
import { isCaptchaConfigured } from '@/lib/auth/captcha';

/**
 * Where the Turnstile check stands. `challenge` means Cloudflare is asking the
 * person to do something; `failed` and `expired` are the two ways a check ends
 * without a token and both need a retry (FRESCO-944).
 */
export type CaptchaStatus = 'verifying' | 'challenge' | 'passed' | 'failed' | 'expired';

export interface Captcha {
  /** A site key is configured for this build. */
  enabled: boolean
  /** Token from the solved widget; `null` until solved, after expiry, or after `reset()`. */
  token: string | null
  /** True when the form may submit: no captcha configured, or a token is in hand. */
  ready: boolean
  status: CaptchaStatus
  /** Bumped by `reset()`; the widget re-renders on change to issue a fresh challenge. */
  resetKey: number
  /** A token marks the check as passed; `null` leaves the status to `setStatus`. */
  setToken: (token: string | null) => void
  setStatus: (status: CaptchaStatus) => void
  /** A Turnstile token is single-use: call after every auth request, success or failure. */
  reset: () => void
}

export function useCaptcha(enabled: boolean = isCaptchaConfigured()): Captcha {
  const [token, setTokenState] = useState<string | null>(null);
  const [status, setStatus] = useState<CaptchaStatus>('verifying');
  const [resetKey, setResetKey] = useState(0);

  const setToken = useCallback((next: string | null) => {
    setTokenState(next);
    if (next !== null) {
      setStatus('passed');
    }
  }, []);

  const reset = useCallback(() => {
    setTokenState(null);
    setStatus('verifying');
    setResetKey(key => key + 1);
  }, []);

  return { enabled, token, ready: !enabled || token !== null, status, resetKey, setToken, setStatus, reset };
}
