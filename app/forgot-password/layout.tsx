import type { Metadata } from 'next';

// FRESCO-174: see app/login/layout.tsx — same reason (client page.tsx can't
// export metadata itself).
// FRESCO-473: transactional utility screen, no unique indexable content —
// noindex keeps it out of search results while still letting crawlers
// follow any link on the page.
export const metadata: Metadata = {
  title: 'Recuperar contraseña · Fresco',
  robots: { index: false, follow: true },
};

// FRESCO-315: `<main>` landmark for the auth route (the public pages had none).
export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <main id="main">{children}</main>;
}
