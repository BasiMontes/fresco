import { describe, expect, it } from 'bun:test';
import { captchaMissingInProduction, captchaOptions, isCaptchaConfigured } from '@/lib/auth/captcha';

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

/** FRESCO-1170: only the production deploy treats a missing site key as an error. */
describe('captchaMissingInProduction', () => {
  it('a production deploy without the key is missing it, whatever the spelling of "nothing"', () => {
    expect(captchaMissingInProduction({ VERCEL_ENV: 'production' })).toBe(true);
    expect(captchaMissingInProduction({ VERCEL_ENV: 'production', NEXT_PUBLIC_TURNSTILE_SITE_KEY: '' })).toBe(true);
    expect(captchaMissingInProduction({ VERCEL_ENV: 'production', NEXT_PUBLIC_TURNSTILE_SITE_KEY: '   ' })).toBe(true);
  });

  it('a production deploy with the key is fine', () => {
    expect(captchaMissingInProduction({ VERCEL_ENV: 'production', NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAAexample' })).toBe(false);
  });

  it.each(['preview', 'development', undefined])('a %p deploy without the key keeps the opt-in behaviour (previews, local, the CI build)', (vercelEnv) => {
    expect(captchaMissingInProduction({ VERCEL_ENV: vercelEnv })).toBe(false);
  });
});
