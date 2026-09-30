'use client';

import { useEffect, useRef } from 'react';
import { useCookieConsent } from '@/components/legal/cookie-consent-context';
import { Button } from '@/components/ui/button';

/**
 * FRESCO-428 — first-layer cookie banner. All three actions use the SAME
 * `Button` variant (`secondary`, equal visual weight) deliberately: the AC
 * requires "Aceptar" / "Rechazar" / "Configurar" to carry equal weight, so
 * no variant here reads as the highlighted/default choice — a dark pattern
 * this story explicitly rules out. Sits below `Dialog`'s `z-1000` (a
 * settings dialog opened from here or from the footer/Ajustes must render
 * on top of it) and above the app's `dropdown: 100` tier, reusing that same
 * z-index rather than reserving a new one for a single call site.
 *
 * FRESCO-536: `h-[190px] sm:h-auto` — the Figtree body-copy font swap (kept
 * at `display: swap` per FRESCO-496, unlike the `optional` hero face)
 * reflows this paragraph's line wrap on mobile, and since this box is
 * `fixed bottom-0` with auto height, that reflow moves its own `top` and
 * scored as this repo's entire measured mobile CLS (0.104). A `min-height`
 * matching only the settled (post-swap) height did NOT fix this on a real
 * network — verified against the deployed staging URL, not just localhost:
 * next/font's automatic fallback-metric override matches vertical ascent/
 * descent, not per-glyph advance widths, so the fallback face can still wrap
 * this paragraph onto a taller box than Figtree's final line count, and a
 * `min-height` floor doesn't stop that taller box from *shrinking* back down
 * when the swap lands. A fixed `height` with a one-line buffer over the
 * settled 158px covers that shrink regardless of which face renders first.
 * Reset above `sm:` where the row layout is shorter and stable.
 */
export function CookieConsentBanner() {
  const { bannerVisible, accept, reject, openSettings } = useCookieConsent();
  const bannerRef = useRef<HTMLDivElement>(null);

  // FRESCO-757: above `sm` the banner's height is content-driven (100-120px
  // depending on the copy's wrap), so the CSS constants in `globals.css` are
  // only the pre-hydration fallback. Once mounted, the banner publishes its
  // real height as `--cookie-banner-h`, which sizes the spacer below and lifts
  // the mobile bottom tab bar exactly on top of it (no gap, no overlap). This
  // only moves those two, never the banner itself, so FRESCO-536's CLS fix holds.
  useEffect(() => {
    const banner = bannerRef.current;
    if (!banner) { return; }
    const root = document.documentElement;
    const publishHeight = () => root.style.setProperty('--cookie-banner-h', `${Math.ceil(banner.getBoundingClientRect().height)}px`);
    publishHeight();
    if (typeof ResizeObserver === 'undefined') { return () => root.style.removeProperty('--cookie-banner-h'); }
    const observer = new ResizeObserver(publishHeight);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--cookie-banner-h');
    };
  }, [bannerVisible]);

  if (!bannerVisible) { return null; }

  return (
    <>
      {/* FRESCO-756: the banner is `fixed`, so it takes no room in the page and
          covered whatever sat at the bottom of the document (footer links, the
          onboarding CTAs) with no way to scroll it clear. This in-flow spacer,
          last in `<body>`, adds exactly that room; it leaves with the banner. */}
      <div aria-hidden="true" data-testid="cookie_consent_banner_spacer" className="h-(--cookie-banner-h)" />
      <div
        ref={bannerRef}
        role="region"
        aria-label="Consentimiento de cookies"
        data-testid="cookie_consent_banner"
        data-cookie-banner=""
        className="fixed inset-x-0 bottom-0 z-100 h-[190px] border-t border-border bg-surface-raised p-4 shadow-lg sm:h-auto"
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
    </>
  );
}
