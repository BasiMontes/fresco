'use client';

import { Cookie, FileText, Shield } from 'lucide-react';
import { useState } from 'react';
import { useCookieConsent } from '@/components/legal/cookie-consent-context';
import { LegalModal } from '@/components/legal/legal-modal';
import { HelpRow } from '@/components/profile/help-row';

type LegalModalKey = 'terminos' | 'privacidad' | null;

/**
 * `/profile` "Legal" card (FRESCO-1070): the three legal entry points that used to
 * share the Ayuda list. `Privacidad` and `Términos de Servicio` open the shared
 * `LegalModal`; `Cookies` opens the single `CookieSettingsDialog` mounted once in
 * `app/layout.tsx` through the consent context (FRESCO-428), not a local modal.
 * The `ayuda_row_*` test ids are kept so existing selectors still find the rows.
 */
export function LegalSection() {
  const [openModal, setOpenModal] = useState<LegalModalKey>(null);
  const { openSettings: openCookieSettings } = useCookieConsent();

  return (
    <>
      <div className="flex flex-col divide-y divide-border">
        <HelpRow icon={Shield} label="Privacidad" testId="ayuda_row_privacidad" onClick={() => setOpenModal('privacidad')} />
        {/* FRESCO-162 — the content already existed in LegalModal (TERMS_SECTIONS),
            just had no entry point from `/profile`. */}
        <HelpRow icon={FileText} label="Términos de Servicio" testId="ayuda_row_terminos" onClick={() => setOpenModal('terminos')} />
        <HelpRow icon={Cookie} label="Cookies" testId="ayuda_row_cookies" onClick={openCookieSettings} />
      </div>

      <LegalModal
        open={openModal === 'terminos'}
        onOpenChange={open => setOpenModal(open ? 'terminos' : null)}
        section="terminos"
      />

      <LegalModal
        open={openModal === 'privacidad'}
        onOpenChange={open => setOpenModal(open ? 'privacidad' : null)}
        section="privacidad"
      />
    </>
  );
}
