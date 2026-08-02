'use client';

import type { LegalSection } from '@/components/legal/legal-modal';
import Image from 'next/image';
import * as React from 'react';
import { LegalModal } from '@/components/legal/legal-modal';

const FOOTER_LINKS: { label: string, section: LegalSection }[] = [
  { label: 'Privacidad', section: 'privacidad' },
  { label: 'Términos', section: 'terminos' },
  { label: 'Contacto', section: 'contacto' },
];

/** Landing footer — same `LegalModal` FRESCO-51 wired into `/login`/`/signup`, dead `href="#"` links replaced with real triggers. */
export function SiteFooter() {
  const [open, setOpen] = React.useState(false);
  const [section, setSection] = React.useState<LegalSection>('terminos');

  function openSection(value: LegalSection) {
    setSection(value);
    setOpen(true);
  }

  return (
    <footer className="bg-primary px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Image src="/brand/logo-negativo.svg" alt="Fresco" width={90} height={27} />
          <div className="flex flex-wrap gap-5">
            {FOOTER_LINKS.map(({ label, section: linkSection }) => (
              <button
                key={label}
                type="button"
                data-testid={`site_footer_${linkSection}_link`}
                onClick={() => openSection(linkSection)}
                className="text-caption text-accent-300"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="border-t border-accent-600 pt-5 text-caption text-accent-500">
          © 2025 Fresco · Hecho con cariño (y muchas lentejas)
        </p>
      </div>

      <LegalModal open={open} onOpenChange={setOpen} section={section} />
    </footer>
  );
}
