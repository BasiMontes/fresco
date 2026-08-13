import type { Metadata } from 'next';

// FRESCO-174: see app/login/layout.tsx — same reason (client page.tsx can't
// export metadata itself).
export const metadata: Metadata = {
  title: 'Recuperar contraseña · Fresco',
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
