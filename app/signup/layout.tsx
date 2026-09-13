import type { Metadata } from 'next';

// FRESCO-174: see app/login/layout.tsx — same reason (client page.tsx can't
// export metadata itself).
// FRESCO-473: unique description so this route stops inheriting the root
// layout's landing copy — it competed with "/" for the same keywords.
export const metadata: Metadata = {
  title: 'Crea tu cuenta · Fresco',
  description: 'Crea tu cuenta gratis en Fresco y genera tu menú semanal personalizado en menos de 30 segundos.',
};

// FRESCO-315: `<main>` landmark for the auth route (the public pages had none).
export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
