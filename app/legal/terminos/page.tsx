import type { Metadata } from 'next';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteNav } from '@/components/landing/site-nav';
import { TermsContent } from '@/components/legal/legal-content';

export const metadata: Metadata = {
  title: 'Términos de Servicio — Fresco',
  description: 'Términos de Servicio de Fresco: descripción del servicio, cuentas de usuario, suscripción y derecho de desistimiento.',
};

/** FRESCO-493 — real indexable route for content that previously only opened inside `LegalModal` (no `href`, invisible to crawlers). Same content component the modal uses (`legal-content.tsx`), same `SiteNav`/`SiteFooter` shell as the landing page — no new visual design. */
export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-16 text-body-md text-text">
        <h1 className="text-h3 mb-6">Términos de Servicio</h1>
        <TermsContent />
      </main>
      <SiteFooter />
    </div>
  );
}
