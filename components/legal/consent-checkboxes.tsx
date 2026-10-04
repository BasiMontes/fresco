'use client';

import type { LegalSection } from '@/components/legal/legal-modal';
import { useState } from 'react';
import { LegalModal } from '@/components/legal/legal-modal';
import { Checkbox } from '@/components/ui/checkbox';
import { CONSENT_TEXTS } from '@/lib/legal/consent';

export interface ConsentCheckboxesProps {
  ageConfirmed: boolean
  termsAccepted: boolean
  onAgeChange: (checked: boolean) => void
  onTermsChange: (checked: boolean) => void
  ageError?: string | null
  termsError?: string | null
}

/**
 * FRESCO-794 (ADR-0040) — the two checkboxes every way of starting to use Fresco
 * must show, neither pre-ticked: confirm being 14 or older, and accept the Terms
 * and the Privacy Policy. Shared by the onboarding identity step (guest and
 * account) and `/signup`, so both paths ask for exactly the same thing.
 *
 * The wording is PROVISIONAL (`lib/legal/consent.ts`). The Terms / Privacy links
 * open `LegalModal` here, not a navigation, so a half-filled form is not lost.
 * The `data-testid`s of the terms checkbox, its links and its error are the ones
 * `/signup` already had, so the existing e2e steps keep working.
 */
export function ConsentCheckboxes({ ageConfirmed, termsAccepted, onAgeChange, onTermsChange, ageError, termsError }: ConsentCheckboxesProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSection, setModalSection] = useState<LegalSection>('terminos');

  function openLegal(section: LegalSection) {
    setModalSection(section);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-start gap-2 text-body-sm text-tertiary">
        <span className="flex size-6 shrink-0 items-center justify-center">
          {/* FRESCO-451: a single agree toggle, not one option among several, so
              the square shape instead of the shared circular indicator. */}
          <Checkbox
            data-testid="confirm_age_checkbox"
            checked={ageConfirmed}
            onChange={e => onAgeChange(e.target.checked)}
            className="rounded-sm"
          />
        </span>
        <span>{CONSENT_TEXTS.age_14}</span>
      </label>
      {ageError && (
        <p data-testid="confirm_age_error_message" role="alert" aria-live="assertive" className="text-body-sm text-error">
          {ageError}
        </p>
      )}

      <label className="flex cursor-pointer items-start gap-2 text-body-sm text-tertiary">
        <span className="flex size-6 shrink-0 items-center justify-center">
          <Checkbox
            data-testid="accept_terms_checkbox"
            checked={termsAccepted}
            onChange={e => onTermsChange(e.target.checked)}
            className="rounded-sm"
          />
        </span>
        <span>
          Acepto los
          {' '}
          <button
            type="button"
            data-testid="accept_terms_link_terminos"
            onClick={() => openLegal('terminos')}
            className="text-primary underline"
          >
            Términos de Servicio
          </button>
          {' '}
          y la
          {' '}
          <button
            type="button"
            data-testid="accept_terms_link_privacidad"
            onClick={() => openLegal('privacidad')}
            className="text-primary underline"
          >
            Política de Privacidad.
          </button>
        </span>
      </label>
      {termsError && (
        <p data-testid="accept_terms_error_message" role="alert" aria-live="assertive" className="text-body-sm text-error">
          {termsError}
        </p>
      )}

      <LegalModal open={modalOpen} onOpenChange={setModalOpen} section={modalSection} />
    </div>
  );
}
