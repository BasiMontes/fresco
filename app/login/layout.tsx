import type { Metadata } from 'next';

// FRESCO-174: `page.tsx` is a client component ('use client'), and the
// `metadata` export is only supported in Server Components — this
// co-located layout is the standard Next.js way to give a client route its
// own <title> without converting the page itself.
// FRESCO-473: unique description so this route stops inheriting the root
// layout's landing copy — it competed with "/" for the same keywords.
export const metadata: Metadata = {
  title: 'Inicia sesión · Fresco',
  description: 'Inicia sesión en Fresco para ver tu menú semanal, tu lista de la compra y tus recetas guardadas.',
};

// FRESCO-315: `<main>` landmark for the auth route (the public pages had none).
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
