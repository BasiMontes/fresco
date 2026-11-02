import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { headersState } from '@/tests/mocks/next-headers';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — the root layout every page is wrapped in. Pinned: the theme cookie is stamped onto
// <html> on the server (no flash), the consent cookie seeds the banner decision, the skip link is the
// first focusable element, and the page metadata is the landing one. `next/font/google` only works
// inside Next's compiler, so it is replaced by two plain font objects.

void mock.module('next/font/google', () => ({
  Fraunces: () => ({ variable: 'font-heading-test' }),
  Figtree: () => ({ variable: 'font-body-test' }),
}));

const { default: RootLayout, metadata, viewport, dynamic } = await import('./layout');

beforeEach(() => {
  headersState.cookies = {};
  headersState.headers = {};
});

async function markup(cookies: Record<string, string> = {}) {
  headersState.cookies = cookies;
  return renderToStaticMarkup(await RootLayout({ children: <p data-testid="page_child">contenido</p> }));
}

describe('RootLayout document', () => {
  test('is a Spanish document carrying both font variables, with the page inside', async () => {
    const html = await markup();
    expect(html).toContain('lang="es"');
    expect(html).toContain('font-heading-test');
    expect(html).toContain('font-body-test');
    expect(html).toContain('data-testid="page_child"');
  });

  test('puts the skip link first, pointing at #main', async () => {
    const html = await markup();
    expect(html).toContain('href="#main"');
    expect(html).toContain('Saltar al contenido');
    expect(html.indexOf('skip_to_content_link')).toBeLessThan(html.indexOf('page_child'));
  });

  test('describes the site to search engines with structured data', async () => {
    const html = await markup();
    expect(html).toContain('application/ld+json');
  });
});

describe('RootLayout theme', () => {
  test('a first visit with no cookie paints the light theme', async () => {
    expect(await markup()).toContain('data-theme="light"');
  });

  test('a saved dark choice is stamped on the server', async () => {
    expect(await markup({ theme: 'dark' })).toContain('data-theme="dark"');
  });

  test('a system choice stamps no theme, so the OS decides', async () => {
    expect(await markup({ theme: 'system' })).not.toContain('data-theme');
  });

  test('a nonsense cookie falls back to light', async () => {
    expect(await markup({ theme: 'neon' })).toContain('data-theme="light"');
  });
});

describe('RootLayout metadata', () => {
  test('shares a branded card, a canonical URL and the Spanish locale', () => {
    expect(String(metadata.title)).toContain('Fresco');
    expect(metadata.openGraph).toMatchObject({ locale: 'es_ES', siteName: 'Fresco', type: 'website' });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(metadata.alternates?.canonical).toBeTruthy();
    expect(metadata.metadataBase).toBeInstanceOf(URL);
  });

  test('sets the browser bar colour for both colour schemes', () => {
    expect(viewport.themeColor).toEqual([
      { media: '(prefers-color-scheme: light)', color: '#faf3e3' },
      { media: '(prefers-color-scheme: dark)', color: '#011101' },
    ]);
  });

  test('renders per request, because the nonce-based CSP needs one', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
