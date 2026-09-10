'use client';

import type { LegalSection } from './legal-modal';
import * as React from 'react';
import { LegalModal } from './legal-modal';

/**
 * FRESCO-51 scope bullet — "reutilizable desde múltiples puntos de entrada":
 * this is that entry point, dropped into `/signup` and `/login` today.
 * FRESCO-53's registro checkbox will trigger `LegalModal` directly from its
 * own links instead of reusing this component (its own local `section`
 * state), not through this footer.
 */
export function LegalLinks() {
  const [open, setOpen] = React.useState(false);
  const [section, setSection] = React.useState<LegalSection>('terminos');

  function openSection(value: LegalSection) {
    setSection(value);
    setOpen(true);
  }

  return (
    <>
      {/* FRESCO-478: text-body-sm (13px) not text-caption (11px) — AC bans
          reading text below 12px; py-3 gives each link a ~44px tap target. */}
      <p className="mt-4 text-center text-body-sm text-tertiary">
        <button type="button" data-testid="legal_links_terms" onClick={() => openSection('terminos')} className="inline-block py-3 underline">
          Términos
        </button>
        {' · '}
        <button type="button" data-testid="legal_links_privacy" onClick={() => openSection('privacidad')} className="inline-block py-3 underline">
          Privacidad
        </button>
        {' · '}
        <button type="button" data-testid="legal_links_contact" onClick={() => openSection('contacto')} className="inline-block py-3 underline">
          Contacto
        </button>
        {' · '}
        <button type="button" data-testid="legal_links_cookies" onClick={() => openSection('cookies')} className="inline-block py-3 underline">
          Cookies
        </button>
      </p>

      <LegalModal open={open} onOpenChange={setOpen} section={section} />
    </>
  );
}
