'use client';

import { useState } from 'react';
import { useCookieConsent } from '@/components/legal/cookie-consent-context';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

export interface CookieSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * FRESCO-428 — the interactive counterpart to `LegalModal`'s `'cookies'`
 * section (which is read-only). Opened from the banner's "Configurar", from
 * `SiteFooter`'s "Configurar cookies" link, and from `AyudaSection`'s
 * "Cookies" row — the one place any of those three surfaces actually change
 * the decision. A single toggle: this story scopes exactly one non-essential
 * category (analítica / PostHog).
 */
export function CookieSettingsDialog({ open, onOpenChange }: CookieSettingsDialogProps) {
  const { decision, saveSettings } = useCookieConsent();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(decision === 'accepted');

  function handleSave() {
    saveSettings(analyticsEnabled);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
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
