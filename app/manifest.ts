import type { MetadataRoute } from 'next';

/**
 * FRESCO-476 (SEO): the site served no web app manifest, so Lighthouse's
 * PWA / Installable audit flagged it and mobile browsers had no install
 * metadata. This is the App Router file convention — Next serves it at
 * `/manifest.webmanifest` (content-type `application/manifest+json`) and
 * injects `<link rel="manifest">` into every page. No request-time APIs, so
 * Next renders it once at build and caches it.
 *
 * Colours come straight from the DESIGN.md brand tokens: `background_color`
 * and `theme_color` are the light-theme page ground (`--color-background`
 * `#faf3e3`), which is also the first-visit default theme (see
 * `app/layout.tsx`). The per-scheme `<meta name="theme-color">` for dark
 * mode is wired via the `viewport` export in `app/layout.tsx`.
 *
 * Icons are generated from the brand mark in `app/icon.svg` — regular
 * (`purpose: 'any'`) at 192/512 plus a `maskable` 512 whose mark sits inside
 * the W3C safe zone. The Apple touch icon is the separate `app/apple-icon.png`
 * file convention.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fresco — Menús semanales que aprenden de lo que cocinas',
    short_name: 'Fresco',
    description:
      'Fresco genera tu menú semanal en menos de 30 segundos y aprende de lo que realmente cocinas cada semana.',
    lang: 'es',
    dir: 'ltr',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf3e3',
    theme_color: '#faf3e3',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
