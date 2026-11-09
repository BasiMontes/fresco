import { describe, expect, mock, test } from 'bun:test';
import sitemap from '@/app/sitemap';
import { canonicalUrl } from './canonical';

// FRESCO-1102 (A8-UI-01): every public route declares its own canonical. The root layout used to set
// the home's, which every page without metadata of its own inherited (legal pages, /sobre-nosotros,
// the 404), contradicting the sitemap that lists them.

// `next/font/google` only works inside Next's compiler (same stand-in as app/layout.test.tsx).
void mock.module('next/font/google', () => ({
  Young_Serif: () => ({ variable: 'font-heading-test' }),
  Figtree: () => ({ variable: 'font-body-test' }),
}));

// Importing a page module only to read its `metadata` export.
const { metadata: root } = await import('@/app/layout');
const { metadata: landing } = await import('@/app/page');
const { metadata: privacidad } = await import('@/app/legal/privacidad/page');
const { metadata: terminos } = await import('@/app/legal/terminos/page');
const { metadata: cookies } = await import('@/app/legal/cookies/page');
const { metadata: contacto } = await import('@/app/legal/contacto/page');
const { metadata: sobreNosotros } = await import('@/app/sobre-nosotros/page');
const { metadata: notFound } = await import('@/app/not-found');

const PUBLIC_ROUTES = {
  '/': landing,
  '/legal/privacidad': privacidad,
  '/legal/terminos': terminos,
  '/legal/cookies': cookies,
  '/legal/contacto': contacto,
  '/sobre-nosotros': sobreNosotros,
} as const;

describe('route canonicals', () => {
  test('the root layout declares none, so nothing can inherit the home', () => {
    expect(root.alternates?.canonical).toBeUndefined();
  });

  for (const [path, metadata] of Object.entries(PUBLIC_ROUTES)) {
    test(`${path} declares its own canonical`, () => {
      expect(metadata.alternates?.canonical).toBe(canonicalUrl(path));
    });
  }

  test('every sitemap URL has a page that canonicalises to that same path', () => {
    process.env.VERCEL_ENV = 'production';
    try {
      const paths = sitemap().map(entry => new URL(entry.url).pathname);
      expect(paths.length).toBeGreaterThan(1);
      for (const path of paths) {
        const declared = (PUBLIC_ROUTES as Record<string, { alternates?: { canonical?: unknown } }>)[path]
          ?.alternates
          ?.canonical;
        expect(typeof declared).toBe('string');
        expect(new URL(declared as string).pathname).toBe(path);
      }
    }
    finally {
      delete process.env.VERCEL_ENV;
    }
  });

  test('the 404 is noindex and declares no canonical', () => {
    expect(notFound.alternates?.canonical).toBeUndefined();
    expect(notFound.robots).toMatchObject({ index: false });
  });
});
