import type { Metadata } from 'next';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteNav } from '@/components/landing/site-nav';
import { CONTACT_EMAIL } from '@/components/legal/legal-modal';

export const metadata: Metadata = {
  title: 'Sobre nosotros — Fresco',
  description: 'Qué es Fresco y por qué existe.',
};

/**
 * FRESCO-493 — this page didn't exist anywhere before this ticket (no
 * content, no route). The copy below is agent-drafted from
 * `.context/business/business-model.md` (Problem Statement + Value
 * Propositions sections) and the founder identity already published in
 * `LEGAL_ENTITY` (`legal-content-data.ts`) — not founder-reviewed yet. Unlike
 * `TERMS_SECTIONS`/`PRIVACY_SECTIONS`, this carries no compliance weight (it's
 * marketing/about copy, not a legal document), so no user-facing "draft"
 * banner — just this note for the next person who touches it.
 */
export default function SobreNosotrosPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-16 text-body-md text-text">
        <h1 className="text-h3 mb-6">Sobre nosotros</h1>
        <div className="flex flex-col gap-4">
          <p>
            Fresco existe para resolver un problema muy concreto: la pregunta de "¿qué cocino esta semana?"
            que vuelve cada domingo, 52 veces al año. No es un problema de falta de recetas — de eso ya hay
            de sobra en cualquier sitio. Es un problema de planificación y fatiga de decisión, repetido
            semana tras semana sin que nada mejore con el uso.
          </p>
          <p>
            Fresco genera tu menú semanal y tu lista de la compra en segundos, a partir de tu dieta, tus
            alergias y lo que no te gusta comer. Y acierta más cada semana porque aprende de lo que
            realmente cocinas y descartas — no solo de lo que dices que te gusta la primera vez que lo
            configuras.
          </p>
          <p>
            Detrás de Fresco está
            {' '}
            Basilio Montes Castaño
            , desarrollándolo como proyecto propio. Si tienes dudas, sugerencias o encuentras algo raro,
            escríbeme directamente:
            {' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              data-testid="sobre_nosotros_contact_email_link"
              className="text-primary underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
