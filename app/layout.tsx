import type { Metadata } from 'next';
import { Caprasimo, Figtree } from 'next/font/google';

import './globals.css';

// DESIGN.md Typography: Caprasimo (display, weight 400 only) for headings,
// Figtree (400/600/700) for body copy. Exposed as CSS variables consumed by
// tailwind.config.ts's `fontFamily.heading` / `fontFamily.sans`.
const caprasimo = Caprasimo({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-heading',
});

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'Fresco — Menús semanales con IA que aprende de lo que realmente cocinas',
  description:
    'Fresco genera tu menú semanal en menos de 30 segundos y aprende de lo que realmente cocinas cada semana.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${caprasimo.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
