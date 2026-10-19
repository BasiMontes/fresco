import { describe, expect, test } from 'bun:test';
import { COOKIE_TABLE } from './legal-content-data';

/**
 * FRESCO-979 — registering `/sw.js` for every signed-in user stores a cache on
 * their device, so the cookie policy lists it (founder decision 2026-10-16).
 */
describe('COOKIE_TABLE', () => {
  test('lists the service worker and its offline cache as a technical item', () => {
    const row = COOKIE_TABLE.find(item => item.name.includes('fresco-offline-v1'));

    expect(row).toBeDefined();
    expect(row?.type).toBe('Técnica');
    expect(row?.purpose).toContain('no hay conexión');
    expect(row?.purpose).toContain('nunca tus datos');
  });

  test('FRESCO-1008: declares the Sentry trace id kept in sessionStorage as a technical item', () => {
    const row = COOKIE_TABLE.find(item => item.provider === 'Sentry');

    expect(row?.name).toContain('sentry_previous_trace');
    expect(row?.type).toBe('Técnica');
    expect(row?.purpose).toContain('No contiene datos personales');
  });
});
