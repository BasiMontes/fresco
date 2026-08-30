import type { Metadata } from 'next';

// FRESCO-293: `page.tsx` is a client component ('use client') and can't
// export `metadata` itself — this co-located layout gives the route its own
// <title> (WCAG 2.4.2), matching the pattern in app/login/layout.tsx.
export const metadata: Metadata = {
  title: 'Nueva contraseña · Fresco',
};

export default function UpdatePasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
