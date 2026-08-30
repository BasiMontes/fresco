import type { Metadata } from 'next';

// FRESCO-293: `page.tsx` is a client component ('use client') and can't
// export `metadata` itself — this co-located layout gives the route its own
// <title> (WCAG 2.4.2), matching the pattern in app/login/layout.tsx.
export const metadata: Metadata = {
  title: 'Completa tu perfil · Fresco',
};

// FRESCO-315: `<main>` landmark for the onboarding route (the public pages had none).
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
