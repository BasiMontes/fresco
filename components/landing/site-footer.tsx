'use client';

import type { LegalSection } from '@/components/legal/legal-modal';
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
        <div className="flex flex-wrap justify-end gap-5">
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
        {/*
          FRESCO-445 (epic FRESCO-436): the footer closes on an oversized
          Fraunces wordmark treated as a graphic element — the "editorial
          signature". It replaces the small negative logo that used to sit in
          the top row; this is now the footer's sole brand mark. Kept as a
          readable <p> (not aria-hidden) so the name is still in the
          accessibility tree and text search. Never bold (DESIGN.md
          Typography — "authority comes from calm, not weight").
        */}
        <p className="mt-16 font-heading text-6xl font-normal leading-none tracking-tight text-accent-200 md:text-7xl">
          Fresco
        </p>
      </div>

      <LegalModal open={open} onOpenChange={setOpen} section={section} />
    </footer>
  );
}
