import type { Metadata } from 'next';

// FRESCO-174: see app/login/layout.tsx — same reason (client page.tsx can't
// export metadata itself).
export const metadata: Metadata = {
  title: 'Crea tu cuenta · Fresco',
};

// FRESCO-315: `<main>` landmark for the auth route (the public pages had none).
export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
