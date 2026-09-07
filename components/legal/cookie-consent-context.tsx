'use client';

import type { ReactNode } from 'react';
import type { CookieConsentDecision } from '@/lib/consent/cookie-consent';
import posthog from 'posthog-js';
import { createContext, use, useCallback, useMemo, useState } from 'react';
import { clearPostHogStorage, writeCookieConsent } from '@/lib/consent/cookie-consent';

interface CookieConsentContextValue {
  /** `null` = no decision yet — the banner should be visible. */
  decision: CookieConsentDecision | null
  bannerVisible: boolean
  settingsOpen: boolean
  accept: () => void
  reject: () => void
  openSettings: () => void
  closeSettings: () => void
  /** Used by `CookieSettingsDialog`'s "Guardar" action — a single analytics toggle. */
  saveSettings: (analyticsEnabled: boolean) => void
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function useCookieConsent(): CookieConsentContextValue {
  const value = use(CookieConsentContext);
  if (!value) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider');
  }
  return value;
}

export interface CookieConsentProviderProps {
  children: ReactNode
  /** Server-read cookie value (`app/layout.tsx`) — avoids a banner flash on hydration. */
  initialDecision: CookieConsentDecision | null
}

/**
 * FRESCO-428 / ADR-0025 — single source of truth for the consent decision.
 * `PostHogProvider` reads `decision` from here to gate `posthog.init()`;
 * `CookieConsentBanner`, `CookieSettingsDialog`, `SiteFooter`, and
 * `AyudaSection` all write through this instead of touching the cookie
 * directly, so every surface stays in sync without prop-drilling.
 */
export function CookieConsentProvider({ children, initialDecision }: CookieConsentProviderProps) {
  const [decision, setDecision] = useState<CookieConsentDecision | null>(initialDecision);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const applyDecision = useCallback((next: CookieConsentDecision) => {
    const wasAccepted = decision === 'accepted';
    writeCookieConsent(next);
    setDecision(next);
    setSettingsOpen(false);

    // Withdrawal: an already-initialized PostHog instance must stop
    // capturing and its own persisted state must be cleared (ADR-0025) —
    // never leave the SDK running with events an unconsenting user rejected.
    if (wasAccepted && next === 'rejected') {
      const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      if (key) {
        posthog.opt_out_capturing();
        posthog.reset();
        clearPostHogStorage(key);
      }
    }
  }, [decision]);

  const accept = useCallback(() => applyDecision('accepted'), [applyDecision]);
  const reject = useCallback(() => applyDecision('rejected'), [applyDecision]);
  const saveSettings = useCallback((analyticsEnabled: boolean) => {
    applyDecision(analyticsEnabled ? 'accepted' : 'rejected');
  }, [applyDecision]);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const value = useMemo<CookieConsentContextValue>(() => ({
    decision,
    bannerVisible: decision === null,
    settingsOpen,
    accept,
    reject,
    openSettings,
    closeSettings,
    saveSettings,
  }), [decision, settingsOpen, accept, reject, openSettings, closeSettings, saveSettings]);

  return (
    <CookieConsentContext value={value}>
      {children}
    </CookieConsentContext>
  );
}
