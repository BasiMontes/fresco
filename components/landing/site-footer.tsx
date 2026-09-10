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

// FRESCO-315: 44px comfortable tap target (was ~26px) — text unchanged.
// FRESCO-445: text-accent-300 (#8fab8d) on bg-primary was ~3.9:1 —
// under AA for 11px text; accent-200 clears it at ~6:1. Shared by every
// footer link (FOOTER_LINKS-driven and the standalone "Configurar cookies"
// button) so a future tweak can't update one and miss the other.
// FRESCO-478: text-body-sm (13px) — AC bans reading text below 12px; the
// larger size only widens the accent-200 contrast margin.
const FOOTER_LINK_CLASSNAME = 'inline-flex min-h-[44px] items-center text-body-sm text-accent-200';

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
                className={FOOTER_LINK_CLASSNAME}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              data-testid="site_footer_cookie_settings_link"
              onClick={openSettings}
              className={FOOTER_LINK_CLASSNAME}
            >
              Configurar cookies
            </button>
          </div>
        </div>
        {/*
          FRESCO-445: was `text-accent-500` (#0F4E0E) on `bg-primary`
          (#0F4E0E) — a 1:1 contrast, the copyright line rendered invisible.
          `text-accent-200` matches the legal-links treatment right above and
          clears AA (~6:1); FRESCO-478 bumped this line to text-body-sm (13px).
        */}
        <p className="mt-5 border-t border-accent-600 pt-5 text-body-sm text-accent-200">
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
