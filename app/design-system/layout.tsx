import type { Metadata } from 'next';

/**
 * FRESCO-1207: public design-system docs, outside `(app)` so it needs no session, like `/qa`.
 * `noindex` only keeps it out of search results (the `robots.ts` Disallow is the second belt); it is
 * NOT access control: anyone with the URL can read it, so nothing private may ever be rendered here.
 */
export const metadata: Metadata = {
  title: 'Sistema de diseño — Fresco',
  description: 'Documentación del sistema de diseño de Fresco.',
  robots: { index: false, follow: false },
};

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return <main id="main" className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12">{children}</main>;
}
