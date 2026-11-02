import { describe, expect, test } from 'bun:test';
import manifest from './manifest';

// FRESCO-1079 — the web app manifest the browser reads to offer installing Fresco. Pinned: the app
// installs as a standalone app from the root, in Spanish, with every icon the install prompt needs.

describe('manifest', () => {
  const m = manifest();

  test('installs as a standalone app rooted at /', () => {
    expect(m).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', lang: 'es', dir: 'ltr', short_name: 'Fresco' });
  });

  test('uses the light brand ground for the splash and the browser bar', () => {
    expect(m.background_color).toBe('#faf3e3');
    expect(m.theme_color).toBe('#faf3e3');
  });

  test('ships a regular 192, a regular 512 and a maskable 512 icon', () => {
    expect(m.icons?.map(i => `${i.sizes}:${i.purpose}`)).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
    expect(m.icons?.every(i => i.type === 'image/png' && i.src.startsWith('/icons/'))).toBe(true);
  });

  test('has a name and a description to show in the install prompt', () => {
    expect(m.name).toContain('Fresco');
    expect(m.description).toBeTruthy();
  });
});
