'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCookieConsent } from '@/components/legal/cookie-consent-context';

// FRESCO-493: real hrefs to the indexable `/legal/*` + `/sobre-nosotros`
// routes — these used to be `onClick` triggers for `LegalModal` with no
// `href`, invisible to a static crawler (the original audit gap). The modal
// stays wired into `/login` and `/signup`'s own in-flow UX; the footer's job
// is discoverability, so plain navigation is simpler and sufficient here.
const FOOTER_LINKS: { label: string, href: string }[] = [
  { label: 'Privacidad', href: '/legal/privacidad' },
  { label: 'Términos', href: '/legal/terminos' },
  { label: 'Política de Cookies', href: '/legal/cookies' },
  { label: 'Contacto', href: '/legal/contacto' },
  { label: 'Sobre nosotros', href: '/sobre-nosotros' },
];

// FRESCO-315: 44px comfortable tap target (was ~26px) — text unchanged.
// FRESCO-445: text-accent-300 (#8fab8d) on bg-primary was ~3.9:1 —
// under AA for 11px text; accent-200 clears it at ~6:1. Shared by every
// footer link (FOOTER_LINKS-driven and the standalone "Configurar cookies"
// button) so a future tweak can't update one and miss the other.
// FRESCO-478: text-body-sm (13px) — AC bans reading text below 12px; the
// larger size only widens the accent-200 contrast margin.
const FOOTER_LINK_CLASSNAME = 'inline-flex min-h-[44px] items-center text-body-sm text-accent-200';

/** Landing footer — legal/about links are real routes (FRESCO-493); `LegalModal` FRESCO-51 stays wired into `/login`/`/signup` for their own in-flow UX. */
export function SiteFooter() {
  const { openSettings } = useCookieConsent();

  return (
    <footer data-brand-ground className="bg-primary px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-5">
          {/*
            The white "negativo" mark is a static asset, not a themed text
            color — it reads correctly on `bg-primary` in both light and dark
            mode without depending on a `light-dark()` token pairing.
          */}
          <Image src="/brand/logo-negativo.svg" alt="Fresco" width={100} height={30} />
          <div className="flex flex-wrap gap-5">
            {FOOTER_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                data-testid={`site_footer_${href.replace(/\//g, '_').replace(/^_/, '')}_link`}
                className={FOOTER_LINK_CLASSNAME}
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              data-testid="site_footer_cookie_settings_link"
              onClick={openSettings}
              className={FOOTER_LINK_CLASSNAME}
            >
              Configurar cookies
            </button>
          </div>
        </div>
        {/*
          FRESCO-445: was `text-accent-500` (#0F4E0E) on `bg-primary`
          (#0F4E0E) — a 1:1 contrast, the copyright line rendered invisible.
          `text-accent-200` matches the legal-links treatment right above and
          clears AA (~6:1); FRESCO-478 bumped this line to text-body-sm (13px).
        */}
        <p className="mt-5 border-t border-accent-600 pt-5 text-body-sm text-accent-200">
          ©
          {' '}
          {new Date().getFullYear()}
          {' '}
          Fresco · Hecho con cariño (y muchas lentejas)
        </p>
      </div>
    </footer>
  );
}
