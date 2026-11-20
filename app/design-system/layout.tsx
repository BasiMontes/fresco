import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { DesignSystemNav } from '@/components/design-system/nav';

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
  return (
    <main id="main" className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12">
      {/* FRESCO-1216: the brand mark the landing and the login already use; both `<Image>`s render and the theme CSS shows one. */}
      <header>
        <Link href="/design-system/foundation/colors" data-testid="design_system_brand" className="inline-flex items-center gap-3">
          <Image src="/brand/logo-base.svg" alt="Fresco" width={100} height={30} className="brand-mark--light" priority />
          <Image src="/brand/logo-negativo.svg" alt="Fresco" width={100} height={30} className="brand-mark--dark" priority />
        </Link>
      </header>
      <div className="flex flex-col gap-8 md:flex-row">
        <DesignSystemNav />
        <div className="min-w-0 flex-1">
          {/* FRESCO-1230: the section name is a kicker above every page title (the DESIGN.md `h6` eyebrow style), rendered once here; the header keeps only the logo, so there is nothing to align. */}
          <p data-testid="design_system_eyebrow" className="mb-2 text-h6 uppercase text-tertiary">Sistema de diseño</p>
          {children}
        </div>
      </div>
    </main>
  );
}
