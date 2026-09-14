import type { Metadata } from 'next';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteNav } from '@/components/landing/site-nav';
import { CookiesContent } from '@/components/legal/legal-content';

export const metadata: Metadata = {
  title: 'Política de Cookies — Fresco',
  description: 'Qué cookies usa Fresco, quién las pone y cuánto duran.',
};

/** FRESCO-493 — real indexable route, same content component `LegalModal` uses. See `app/legal/terminos/page.tsx` for the pattern this mirrors. */
export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-16 text-body-md text-text">
        <h1 className="text-h3 mb-6">Política de Cookies</h1>
        <CookiesContent />
      </main>
      <SiteFooter />
    </div>
  );
}
