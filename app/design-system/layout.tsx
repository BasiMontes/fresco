import type { Metadata } from 'next';

/**
 * FRESCO-1207: public design-system docs, outside `(app)` so it needs no session, like `/qa`.
 * Two signals keep it out of search, same as `/qa`: the `noindex` below and the `robots.ts` Disallow.
 * A compliant crawler obeys the Disallow first and never fetches the page, so it never reads the
 * `noindex`; the tag only matters for a crawler that ignores robots.txt. Neither is access control:
 * anyone with the URL can read it, so nothing private may ever be rendered here.
 */
export const metadata: Metadata = {
  title: 'Sistema de diseño — Fresco',
  description: 'Documentación del sistema de diseño de Fresco.',
  robots: { index: false, follow: false },
};

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return <main id="main" className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12">{children}</main>;
}
