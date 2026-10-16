import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-979 — `public/offline.html` is served by the service worker to anyone
 * whose navigation fails, from a cache filled at install time. It must be the
 * same static file for everybody: no script (the CSP is nonce + strict-dynamic,
 * so it would be blocked anyway), no account data, and only assets the worker
 * actually precaches.
 */

const html = readFileSync(new URL('../../public/offline.html', import.meta.url), 'utf8');
/** The page as sent, minus its HTML comments (they are notes for maintainers, not content). */
const content = html.replace(/<!--[\s\S]*?-->/g, '');
const sw = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

describe('public/offline.html', () => {
  test('is a Spanish page with a short, non-blaming message and a retry link to the current URL', () => {
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<h1>Sin conexión</h1>');
    expect(html).toContain('No hemos podido cargar Fresco');
    expect(html).toMatch(/<a class="retry" href="">Reintentar<\/a>/);
  });

  test('retries on its own with a meta refresh and tells search engines to ignore it', () => {
    // Prettier writes void tags as `<meta ... />`; accept both spellings.
    expect(html).toMatch(/<meta http-equiv="refresh" content="20"\s*\/?>/);
    expect(html).toMatch(/<meta name="robots" content="noindex"\s*\/?>/);
  });

  test('has no JavaScript at all: no script tag, no inline handler, no javascript: URL', () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  test('carries no account data and fetches nothing', () => {
    // The only "@" allowed is the one in `@media`.
    expect(content.replace(/@media/g, '')).not.toContain('@');
    for (const forbidden of ['supabase', 'access_token', 'refresh_token', 'bearer', 'jwt', 'session', 'user', 'email', 'cookie', 'fetch(', 'XMLHttpRequest', '{{', '${', '<%']) {
      expect(content.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  test('is one self-contained file: no external request of any kind', () => {
    // The worker only answers navigations, so a separate image, stylesheet or
    // font request from this page would go to the network and fail offline.
    expect(content).not.toMatch(/\ssrc\s*=/i);
    expect(content).not.toMatch(/<link\b/i);
    expect(content).not.toMatch(/url\(/i);
    expect(content).not.toMatch(/@import/i);
    // The only link is the retry one, to the current URL.
    expect([...content.matchAll(/\bhref\s*=\s*"([^"]*)"/g)].map(m => m[1])).toEqual(['']);
  });

  test('carries both brand logos inline, one per colour scheme', () => {
    expect(content.match(/<svg\s+class="logo logo--(?:light|dark)"/g)).toHaveLength(2);
    expect(content).toContain('aria-label="Fresco"');
  });

  test('is exactly what the service worker precaches', () => {
    expect(sw).toContain('const OFFLINE_URL = \'/offline.html\';');
    expect(sw).toContain('const PRECACHE_URLS = [OFFLINE_URL];');
  });

  test('uses both colour schemes of the design tokens', () => {
    expect(html).toContain('prefers-color-scheme: dark');
    // light and dark ground of DESIGN.md
    expect(html).toContain('#faf3e3');
    expect(html).toContain('#011101');
  });
});
