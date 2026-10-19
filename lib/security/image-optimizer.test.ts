import { describe, expect, test } from 'bun:test';
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern';
import nextConfig from '../../next.config.mjs';

// FRESCO-1017 (A7-ABUSE-01): `/_next/image` was an open optimizer for any path on two public photo
// libraries, so anyone could drive the Vercel Image Optimization quota. These tests hold the
// allow-list narrow, using Next's own matcher so they prove what `/_next/image` would accept.

const images = nextConfig.images ?? {};
const patterns = images.remotePatterns ?? [];

function allowed(url: string): boolean {
  return hasRemoteMatch([], patterns, new URL(url));
}

describe('images.remotePatterns (A7-ABUSE-01)', () => {
  test('every pattern is https and names a pathname that is not a bare wildcard', () => {
    expect(patterns.length).toBeGreaterThan(0);
    for (const pattern of patterns as { protocol?: string, pathname?: string }[]) {
      expect(pattern.protocol).toBe('https');
      expect(pattern.pathname).toBeDefined();
      expect(['/**', '**', '/*']).not.toContain(pattern.pathname);
    }
  });

  test('only the two photo hosts the catalogue uses are listed', () => {
    const hosts = new Set((patterns as { hostname: string }[]).map(pattern => pattern.hostname));
    expect([...hosts].sort()).toEqual(['images.pexels.com', 'images.unsplash.com']);
  });

  test('accepts the shapes real recipe photos have', () => {
    expect(allowed('https://images.unsplash.com/photo-1696950169729-228abf39fbaa?crop=entropy&w=1080')).toBe(true);
    expect(allowed('https://images.unsplash.com/flagged/photo-1577054588868-d5ac2299e402?q=80&w=1080')).toBe(true);
    expect(allowed('https://images.pexels.com/photos/1346347/pexels-photo-1346347.jpeg?auto=compress')).toBe(true);
  });

  test('rejects paths outside the photo areas of either library', () => {
    expect(allowed('https://images.unsplash.com/premium_photo-1234567890')).toBe(false);
    expect(allowed('https://images.unsplash.com/some/other/path.jpg')).toBe(false);
    expect(allowed('https://images.unsplash.com/')).toBe(false);
    expect(allowed('https://images.pexels.com/videos/123/clip.mp4')).toBe(false);
    expect(allowed('https://images.pexels.com/')).toBe(false);
  });

  test('rejects other hosts, other protocols and look-alike hosts', () => {
    expect(allowed('https://example.com/photo-1')).toBe(false);
    expect(allowed('http://images.unsplash.com/photo-1')).toBe(false);
    expect(allowed('https://images.unsplash.com.evil.test/photo-1')).toBe(false);
  });
});

describe('image optimizer size knobs (A7-ABUSE-01)', () => {
  test('only quality 75 is accepted', () => {
    expect(images.qualities).toEqual([75]);
  });

  test('the width lists stay short, so the width x quality product stays small', () => {
    const widths = [...(images.deviceSizes ?? []), ...(images.imageSizes ?? [])];
    expect(widths.length).toBeGreaterThan(0);
    expect(widths.length).toBeLessThanOrEqual(10);
    expect(Math.max(...widths)).toBeLessThanOrEqual(1920);
  });

  test('optimized images are cached for at least a week', () => {
    expect(images.minimumCacheTTL ?? 0).toBeGreaterThanOrEqual(7 * 24 * 3600);
  });
});
