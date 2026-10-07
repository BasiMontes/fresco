import { describe, expect, it } from 'bun:test';
import { timingSafeEqual } from '@/lib/auth/timing-safe-equal';

describe('timingSafeEqual', () => {
  it('is true for identical strings, including non-ASCII and empty ones', () => {
    expect(timingSafeEqual('Bearer cron_secret_1', 'Bearer cron_secret_1')).toBe(true);
    expect(timingSafeEqual('contraseña-ñ', 'contraseña-ñ')).toBe(true);
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('is false when one character differs, wherever it sits', () => {
    expect(timingSafeEqual('Bearer cron_secret_1', 'Xearer cron_secret_1')).toBe(false);
    expect(timingSafeEqual('Bearer cron_secret_1', 'Bearer cron_secret_X')).toBe(false);
  });

  it('is false for strings of different length, without throwing', () => {
    expect(timingSafeEqual('Bearer cron_secret_1', 'Bearer cron')).toBe(false);
    expect(timingSafeEqual('Bearer cron', 'Bearer cron_secret_1')).toBe(false);
    expect(timingSafeEqual('Bearer cron_secret_1', '')).toBe(false);
  });
});
