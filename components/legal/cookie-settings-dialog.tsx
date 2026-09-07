'use client';

import { useEffect, useState } from 'react';
import { useCookieConsent } from '@/components/legal/cookie-consent-context';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

/**
 * FRESCO-428 — the interactive counterpart to `LegalModal`'s `'cookies'`
 * section (which is read-only). A SINGLE instance, mounted once in
 * `app/layout.tsx` next to `CookieConsentBanner`, driven entirely by
 * `useCookieConsent()`'s `settingsOpen`/`closeSettings` — not by local
 * per-caller state. `SiteFooter`'s "Configurar cookies" link,
 * `AyudaSection`'s "Cookies" row, and the banner's own "Configurar" button
 * all call `openSettings()` from the same context instead of each owning a
 * separate `Dialog`; a per-caller instance would leave callers other than
 * the one that opened it unaware the dialog exists (found live: the
 * banner's "Configurar" flipped `settingsOpen` in context with nothing
 * mounted to read it).
 */
export function CookieSettingsDialog() {
  const { decision, settingsOpen, closeSettings, saveSettings } = useCookieConsent();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(decision === 'accepted');

  // This is a single instance that never unmounts (mounted once in
  // `app/layout.tsx`), so a `useState` initializer alone only ever reflects
  // `decision` from the very first render — found live: accepting via the
  // banner, then opening this same dialog without a full reload, showed a
  // stale unchecked toggle. Re-sync on every open so it always starts from
  // the current persisted decision, not whatever it happened to be left at.
  useEffect(() => {
    if (settingsOpen) {
      setAnalyticsEnabled(decision === 'accepted');
    }
  }, [settingsOpen, decision]);

  function handleSave() {
    saveSettings(analyticsEnabled);
    closeSettings();
  }

  return (
    <Dialog
      open={settingsOpen}
      onOpenChange={open => !open && closeSettings()}
      aria-label="Configurar cookies"
      data-testid="cookie_settings_dialog"
    >
      <h2 className="text-h4 pr-8">Configurar cookies</h2>

      <div className="mt-4 flex flex-col gap-4 text-body-sm text-text">
        <div>
          <h3 className="text-label mb-1">Técnicas</h3>
          <p className="text-tertiary">Necesarias para que Fresco funcione (tu sesión, guardar esta misma decisión). Siempre activas.</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <h3 className="text-label mb-1">Analítica</h3>
            <p className="text-tertiary">Nos ayuda a entender cómo se usa Fresco. Solo se activa con tu permiso.</p>
          </div>
          <Switch
            checked={analyticsEnabled}
            onCheckedChange={setAnalyticsEnabled}
            aria-label="Activar cookies de analítica"
            data-testid="cookie_settings_analytics_toggle"
          />
        </div>

        <Button
          type="button"
          size="sm"
          data-testid="cookie_settings_save_button"
          onClick={handleSave}
          className="self-start"
        >
          Guardar preferencias
        </Button>
      </div>
    </Dialog>
  );
}
