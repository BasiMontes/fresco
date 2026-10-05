import { describe, expect, it } from 'bun:test';
import { captchaOptions, isCaptchaConfigured } from '@/lib/auth/captcha';

describe('isCaptchaConfigured', () => {
  it('is off without a site key, so a build can ship before the Supabase setting is on', () => {
    expect(isCaptchaConfigured('')).toBe(false);
    expect(isCaptchaConfigured('   ')).toBe(false);
  });

  it('is on once a site key is present', () => {
    expect(isCaptchaConfigured('0x4AAAAAAAexample')).toBe(true);
  });
});

describe('captchaOptions', () => {
  it('passes the token through as captchaToken', () => {
    expect(captchaOptions('tok-123')).toEqual({ captchaToken: 'tok-123' });
  });

  it('omits the field (undefined, not an empty string) when there is no token', () => {
    expect(captchaOptions(null).captchaToken).toBeUndefined();
  });
});
