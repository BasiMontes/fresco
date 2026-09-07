'use client';

import type { LegalSection } from '@/components/legal/legal-modal';
import Image from 'next/image';
import * as React from 'react';
import { useCookieConsent } from '@/components/legal/cookie-consent-context';
import { LegalModal } from '@/components/legal/legal-modal';

const FOOTER_LINKS: { label: string, section: LegalSection }[] = [
  { label: 'Privacidad', section: 'privacidad' },
  { label: 'Términos', section: 'terminos' },
  { label: 'Política de Cookies', section: 'cookies' },
  { label: 'Contacto', section: 'contacto' },
];

/** Landing footer — same `LegalModal` FRESCO-51 wired into `/login`/`/signup`, dead `href="#"` links replaced with real triggers. */
export function SiteFooter() {
  const [open, setOpen] = React.useState(false);
  const [section, setSection] = React.useState<LegalSection>('terminos');
  const { openSettings } = useCookieConsent();

  function openSection(value: LegalSection) {
    setSection(value);
    setOpen(true);
  }

  return (
    <footer data-brand-ground className="bg-primary px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-5">
          {/*
            The white "negativo" mark is a static asset, not a themed text
            color — it reads correctly on `bg-primary` in both light and dark
            mode without depending on a `light-dark()` token pairing.
          */}
          <Image src="/brand/logo-negativo.svg" alt="Fresco" width={100} height={30} />
          <div className="flex flex-wrap gap-5">
            {FOOTER_LINKS.map(({ label, section: linkSection }) => (
              <button
                key={label}
                type="button"
                data-testid={`site_footer_${linkSection}_link`}
                onClick={() => openSection(linkSection)}
                // FRESCO-315: 44px comfortable tap target (was ~26px) — text unchanged.
                // FRESCO-445: text-accent-300 (#8fab8d) on bg-primary was ~3.9:1 —
                // under AA for 11px text; accent-200 clears it at ~6:1.
                className="inline-flex min-h-[44px] items-center text-caption text-accent-200"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              data-testid="site_footer_cookie_settings_link"
              onClick={openSettings}
              className="inline-flex min-h-[44px] items-center text-caption text-accent-200"
            >
              Configurar cookies
            </button>
          </div>
        </div>
        {/*
          FRESCO-445: was `text-accent-500` (#0F4E0E) on `bg-primary`
          (#0F4E0E) — a 1:1 contrast, the copyright line rendered invisible.
          `text-accent-200` matches the legal-links treatment right above and
          clears AA (~6:1) for this 11px text.
        */}
        <p className="mt-5 border-t border-accent-600 pt-5 text-caption text-accent-200">
          ©
          {' '}
          {new Date().getFullYear()}
          {' '}
          Fresco · Hecho con cariño (y muchas lentejas)
        </p>
      </div>

      <LegalModal open={open} onOpenChange={setOpen} section={section} />
    </footer>
  );
}
