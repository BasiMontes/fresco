'use client';

import type { ConsentKind } from '@/lib/legal/consent';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConsentCheckboxes } from '@/components/legal/consent-checkboxes';
import { HealthConsentBlock } from '@/components/onboarding/health-consent-block';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { signOut } from '@/lib/client-api/auth';
import { postConsents, REGISTRATION_CONSENTS } from '@/lib/legal/consent-client';

/**
 * FRESCO-1007 (audit 7b A7-PRIV-01, A7-PRIV-02) — the blocking dialog that asks a signed-in user to
 * accept the CURRENT Terms, Privacy Policy and age confirmation. The authenticated layout renders
 * it when `getMissingConsents` finds any of them missing: an account created before the registry
 * existed, or one whose rows are of an older `LEGAL_TEXTS_VERSION`. Neither the close button, nor
 * Escape, nor a click outside closes it; the two ways out are accepting, or signing out.
 *
 * It asks for the whole set again, not only the missing kinds: age, Terms and Privacy are given
 * together everywhere else (`ConsentCheckboxes`), and recording a kind that already exists is a
 * no-op. The wording is PROVISIONAL (`lib/legal/consent.ts`).
 *
 * FRESCO-1125 (audit 8 A8-PRIV-04): `missing` says what the layout found absent. A profile with
 * allergens or a halal diet and no `health_data` row at the current version also sees the existing
 * health consent block (the same one onboarding and `/profile` use), which records its own consent.
 * A user missing only that does not see the age and Terms checkboxes again.
 */
const REGISTRATION_KINDS = new Set<ConsentKind>(REGISTRATION_CONSENTS);

export function ReconsentDialog({ missing = REGISTRATION_CONSENTS }: { missing?: readonly ConsentKind[] }) {
  const needsRegistration = missing.some(kind => REGISTRATION_KINDS.has(kind));
  const needsHealth = missing.includes('health_data');
  const [healthConsented, setHealthConsented] = useState(false);
  const router = useRouter();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function accept() {
    setIsSubmitting(true);
    setError(null);
    try {
      if (needsRegistration && !(await postConsents(REGISTRATION_CONSENTS))) {
        setError('No pudimos registrar tu aceptación. Inténtalo de nuevo.');
        return;
      }
      // The layout asks again on the server: with the rows in place it renders without the dialog.
      router.refresh();
    }
    finally {
      setIsSubmitting(false);
    }
  }

  async function leave() {
    await signOut();
    router.push('/login');
  }

  return (
    <Dialog open onOpenChange={() => {}} dismissible={false} aria-label="Acepta los términos para continuar" data-testid="reconsent_dialog">
      <h2 className="text-h4">Antes de seguir, confirma esto</h2>
      {needsRegistration && (
        <>
          <p className="mt-2 text-body-sm text-tertiary">
            Para seguir usando Fresco necesitamos que confirmes tu edad y aceptes la versión vigente de nuestros Términos de Servicio y de la Política de Privacidad.
          </p>

          <div className="mt-4">
            <ConsentCheckboxes
              ageConfirmed={ageConfirmed}
              termsAccepted={termsAccepted}
              onAgeChange={(checked) => { setAgeConfirmed(checked); setError(null); }}
              onTermsChange={(checked) => { setTermsAccepted(checked); setError(null); }}
            />
          </div>
        </>
      )}

      {needsHealth && (
        <HealthConsentBlock consented={healthConsented} onConsentedChange={setHealthConsented} />
      )}

      {error && (
        <p data-testid="reconsent_error_message" role="alert" aria-live="assertive" className="mt-3 text-body-sm text-error">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <Button
          data-testid="reconsent_accept_button"
          onClick={() => void accept()}
          disabled={(needsRegistration && (!ageConfirmed || !termsAccepted)) || (needsHealth && !healthConsented) || isSubmitting}
        >
          {isSubmitting ? 'Guardando…' : 'Aceptar y continuar'}
        </Button>
        <button
          type="button"
          data-testid="reconsent_logout_button"
          onClick={() => void leave()}
          className="text-center text-body-sm text-tertiary underline"
        >
          Cerrar sesión
        </button>
      </div>
    </Dialog>
  );
}
