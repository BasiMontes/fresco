import type { Metadata } from 'next';
import { Caprasimo, Figtree } from 'next/font/google';
import { PostHogProvider } from '@/app/providers/posthog-provider';

import './globals.css';

// NOT `import '@/bones/registry'` here — confirmed live this session that a
// registry import in the root layout doesn't reach `<Skeleton>` usages in
// other route segments: Next.js App Router gives each 'use client' entry
// point (root layout vs. a route's own loading.tsx) its own client bundle
// under Turbopack, and boneyard-js's bone registry is a plain in-memory
// `Map` in module scope — two separate bundle instances of the same
// `boneyard-js/shared.js` module mean two separate Maps, so bones
// registered from one never show up when read from the other. Each file
// that renders `<Skeleton>` imports the registry itself instead — see
// `app/(app)/menu/loading.tsx` etc.

// DESIGN.md Typography: Caprasimo (display, weight 400 only) for headings,
// Figtree (400/600/700) for body copy. Exposed as CSS variables consumed by
// tailwind.config.ts's `fontFamily.heading` / `fontFamily.sans`.
const caprasimo = Caprasimo({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-heading',
});

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'Fresco — Menús semanales que aprenden de lo que realmente cocinas',
  description:
    'Fresco genera tu menú semanal en menos de 30 segundos y aprende de lo que realmente cocinas cada semana.',
};

// FRESCO-386 (A4-M10): the enforcing, nonce-based CSP (see `proxy.ts`) needs
// a per-request nonce stamped onto Next's inline bootstrap script. A page
// prerendered at build time has no request and therefore no nonce, so its
// bootstrap would be blocked by `script-src` (no `'unsafe-inline'`). Forcing
// dynamic rendering app-wide is the documented tradeoff of nonce CSP — no
// CDN caching, no PPR.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${caprasimo.variable} ${figtree.variable}`}>
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
