'use client';

import { useState } from 'react';
import { LegalModal } from '@/components/legal/legal-modal';
import { Checkbox } from '@/components/ui/checkbox';
import { CONSENT_TEXTS } from '@/lib/legal/consent';
import { postConsents } from '@/lib/legal/consent-client';

export interface HealthConsentBlockProps {
  /** Whether the user already gave the `health_data` consent (this session or an earlier one). */
  consented: boolean
  onConsentedChange: (consented: boolean) => void
}

/**
 * FRESCO-794 (ADR-0040) / FRESCO-917 — the explicit consent for allergies and
 * diet (GDPR art. 9), shared by the onboarding diet step and the `/profile`
 * preferences form. The parent decides WHEN to show it (once health data is
 * filled in); this block records the consent through `POST /api/consents` and
 * reports the result. The database refuses to store health data without it.
 *
 * Unticking only flips the local flag: the registry is append-only and a
 * withdrawal is a separate decision (ADR-0040).
 */
export function HealthConsentBlock({ consented, onConsentedChange }: HealthConsentBlockProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  async function handleChange(checked: boolean) {
    setError(null);
    if (!checked) {
      onConsentedChange(false);
      return;
    }
    setIsRecording(true);
    const recorded = await postConsents(['health_data']);
    setIsRecording(false);
    if (recorded) {
      onConsentedChange(true);
    }
    else {
      setError('No pudimos registrar tu consentimiento. Inténtalo de nuevo.');
    }
  }

  return (
    <>
      <div data-testid="health_consent_block" className="mt-4 rounded-md border border-border p-3">
        <p className="text-body-sm text-tertiary">
          Tus alergias y tu dieta son datos de salud. Solo los usamos para excluir las recetas que no te convienen, y necesitamos tu consentimiento explícito para guardarlos. Más información en la
          {' '}
          <button
            type="button"
            data-testid="health_consent_privacy_link"
            onClick={() => setPrivacyOpen(true)}
            className="text-primary underline"
          >
            Política de Privacidad
          </button>
          .
        </p>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-body-sm text-tertiary">
          <span className="flex size-6 shrink-0 items-center justify-center">
            {/* FRESCO-451: a single agree toggle, so the square variant. */}
            <Checkbox
              data-testid="health_consent_checkbox"
              checked={consented}
              disabled={isRecording}
              onChange={e => void handleChange(e.target.checked)}
              className="rounded-sm"
            />
          </span>
          <span>{CONSENT_TEXTS.health_data}</span>
        </label>
        {error && (
          <p data-testid="health_consent_error_message" role="alert" aria-live="assertive" className="mt-2 text-body-sm text-error">
            {error}
          </p>
        )}
        {!consented && !error && (
          <p data-testid="health_consent_required_hint" role="status" aria-live="polite" className="mt-2 text-body-sm text-tertiary">
            Marca la casilla para continuar.
          </p>
        )}
      </div>
      <LegalModal open={privacyOpen} onOpenChange={setPrivacyOpen} section="privacidad" />
    </>
  );
}
