'use client';

import { useCookieConsent } from '@/components/legal/cookie-consent-context';
import { Button } from '@/components/ui/button';

/**
 * FRESCO-428 — first-layer cookie banner. All three actions use the SAME
 * `Button` variant (`secondary`, equal visual weight) deliberately: the AC
 * requires "Aceptar" / "Rechazar" / "Configurar" to carry equal weight, so
 * no variant here reads as the highlighted/default choice — a dark pattern
 * this story explicitly rules out. Sits below `Dialog`'s `z-[1000]` (a
 * settings dialog opened from here or from the footer/Ajustes must render
 * on top of it) and above the app's `dropdown: 100` tier, reusing that same
 * z-index rather than reserving a new one for a single call site.
 */
export function CookieConsentBanner() {
  const { bannerVisible, accept, reject, openSettings } = useCookieConsent();

  if (!bannerVisible) { return null; }

  return (
    <div
      role="region"
      aria-label="Consentimiento de cookies"
      data-testid="cookie_consent_banner"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-surface-raised p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-text">
          Usamos cookies técnicas necesarias para el funcionamiento de Fresco y, solo si lo aceptas, cookies de analítica.
          {' '}
          <button
            type="button"
            onClick={openSettings}
            data-testid="cookie_consent_banner_policy_link"
            // FRESCO-478: 44px tap target (WCAG 2.5.5).
            className="inline-flex min-h-[44px] items-center align-middle underline"
          >
            Más información
          </button>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="cookie_consent_reject_button"
            onClick={reject}
          >
            Rechazar
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="cookie_consent_configure_button"
            onClick={openSettings}
          >
            Configurar
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="cookie_consent_accept_button"
            onClick={accept}
          >
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  );
}
