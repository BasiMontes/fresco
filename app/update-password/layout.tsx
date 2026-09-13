import type { Metadata } from 'next';

// FRESCO-293: `page.tsx` is a client component ('use client') and can't
// export `metadata` itself — this co-located layout gives the route its own
// <title> (WCAG 2.4.2), matching the pattern in app/login/layout.tsx.
// FRESCO-473: only reachable via a one-time recovery link, no unique
// indexable content — noindex keeps it out of search results while still
// letting crawlers follow any link on the page.
export const metadata: Metadata = {
  title: 'Nueva contraseña · Fresco',
  robots: { index: false, follow: true },
};

// FRESCO-315: `<main>` landmark for the auth route (the public pages had none).
export default function UpdatePasswordLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
