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
      <p className="mt-4 text-center text-caption text-tertiary">
        <button type="button" data-testid="legal_links_terms" onClick={() => openSection('terminos')} className="underline">
          Términos
        </button>
        {' · '}
        <button type="button" data-testid="legal_links_privacy" onClick={() => openSection('privacidad')} className="underline">
          Privacidad
        </button>
        {' · '}
        <button type="button" data-testid="legal_links_contact" onClick={() => openSection('contacto')} className="underline">
          Contacto
        </button>
      </p>

      <LegalModal open={open} onOpenChange={setOpen} section={section} />
    </>
  );
}
