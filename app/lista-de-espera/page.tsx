import type { Metadata } from 'next';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteNav } from '@/components/landing/site-nav';
import { WaitlistConfirm } from '@/components/landing/waitlist-confirm';
import { isWaitlistToken } from '@/lib/legal/waitlist';

export const metadata: Metadata = {
  title: 'Lista de espera — Fresco',
  robots: { index: false, follow: false },
};

/**
 * FRESCO-1008 — the page the links of the waitlist email open: confirm the address, or leave the
 * list. The action is a button, not something the page does on load, so a mail scanner that fetches
 * the link changes nothing. The token travels in the query string only to this page and the POST.
 */
export default async function WaitlistPage({ searchParams }: { searchParams: Promise<{ token?: string, accion?: string }> }) {
  const { token, accion } = await searchParams;
  const action = accion === 'baja' ? 'remove' : 'confirm';

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main id="main" className="mx-auto max-w-xl px-4 py-16 text-body-md text-text">
        <h1 className="text-h3 mb-6">Lista de espera</h1>
        {isWaitlistToken(token)
          ? <WaitlistConfirm token={token} action={action} />
          : <p data-testid="waitlist_link_invalid">Este enlace no es válido. Si lo copiaste a mano, vuelve a abrirlo desde el correo.</p>}
      </main>
      <SiteFooter />
    </div>
  );
}
