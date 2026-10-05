'use client';

import { useCallback, useState } from 'react';
import { isCaptchaConfigured } from '@/lib/auth/captcha';

export interface Captcha {
  /** A site key is configured for this build. */
  enabled: boolean
  /** Token from the solved widget; `null` until solved, after expiry, or after `reset()`. */
  token: string | null
  /** True when the form may submit: no captcha configured, or a token is in hand. */
  ready: boolean
  /** Bumped by `reset()`; the widget re-renders on change to issue a fresh challenge. */
  resetKey: number
  setToken: (token: string | null) => void
  /** A Turnstile token is single-use: call after every auth request, success or failure. */
  reset: () => void
}

export function useCaptcha(): Captcha {
  const enabled = isCaptchaConfigured();
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const reset = useCallback(() => {
    setToken(null);
    setResetKey(key => key + 1);
  }, []);

  return { enabled, token, ready: !enabled || token !== null, resetKey, setToken, reset };
}
