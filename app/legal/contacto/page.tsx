import type { Metadata } from 'next';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteNav } from '@/components/landing/site-nav';
import { ContactContent } from '@/components/legal/legal-content';

export const metadata: Metadata = {
  title: 'Contacto — Fresco',
  description: 'Cómo contactar con el equipo de Fresco.',
};

/** FRESCO-493 — real indexable route, same content component `LegalModal` uses. See `app/legal/terminos/page.tsx` for the pattern this mirrors. */
export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-16 text-body-md text-text">
        <h1 className="text-h3 mb-6">Contacto</h1>
        <ContactContent />
      </main>
      <SiteFooter />
    </div>
  );
}
