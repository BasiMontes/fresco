import type { Metadata } from 'next';

// FRESCO-174: `page.tsx` is a client component ('use client'), and the
// `metadata` export is only supported in Server Components — this
// co-located layout is the standard Next.js way to give a client route its
// own <title> without converting the page itself.
export const metadata: Metadata = {
  title: 'Inicia sesión · Fresco',
};

// FRESCO-315: `<main>` landmark for the auth route (the public pages had none).
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
