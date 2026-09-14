'use client';

import {
  ContactContent,
  CookiesContent,
  PrivacyContent,
  TermsContent,
} from '@/components/legal/legal-content';
import { Dialog } from '@/components/ui/dialog';

export type LegalSection = 'terminos' | 'privacidad' | 'contacto' | 'cookies';

const SECTION_LABEL: Record<LegalSection, string> = {
  terminos: 'Términos de Servicio',
  privacidad: 'Política de Privacidad',
  contacto: 'Contacto',
  cookies: 'Política de Cookies',
};

/** Re-exported for `lib/email/templates/subscription-confirmation.ts` (FRESCO-429) — the actual data lives in `legal-content-data.ts` (kept import-cycle-free from `legal-content.tsx`'s render components). */
export { CONTACT_EMAIL, LEGAL_ENTITY } from '@/components/legal/legal-content-data';

export interface LegalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: LegalSection
}

/**
 * FRESCO-51 — Términos de Servicio / Política de Privacidad / Contacto, each
 * its own standalone modal (no shared tab switcher between them — a caller
 * that wants a different document closes this one and opens the other
 * trigger, e.g. `LegalLinks`' three separate links). Wider on desktop
 * (`sm:max-w-2xl` vs `Dialog`'s own `max-w-lg` default) — legal text reads
 * better with more line width than the general-purpose default allows.
 *
 * Contacto is a static email + `mailto:` link, no form, no backend —
 * confirmed with the user before this story's AC was written (a working
 * contact form was explicitly descoped).
 *
 * FRESCO-493 — content rendering moved to `legal-content.tsx` so this modal
 * and the real `/legal/*` routes render the identical JSX, not two copies
 * that can drift. Behavior/markup unchanged (same data-testids).
 */
export function LegalModal({ open, onOpenChange, section }: LegalModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      aria-label={SECTION_LABEL[section]}
      data-testid="legal_modal"
      className="sm:max-w-2xl"
    >
      <h2 className="text-h4 pr-8">{SECTION_LABEL[section]}</h2>

      <div className="mt-4 text-body-md text-text">
        {section === 'terminos' && <TermsContent />}
        {section === 'privacidad' && <PrivacyContent />}
        {section === 'contacto' && <ContactContent />}
        {section === 'cookies' && <CookiesContent />}
      </div>
    </Dialog>
  );
}
