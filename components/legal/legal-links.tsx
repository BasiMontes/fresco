import Link from 'next/link';

/**
 * Legal footer of the access screens (`/login`, `/signup`, `/forgot-password`,
 * `/update-password`).
 *
 * FRESCO-939 (audit UX-07): these were buttons that opened `LegalModal`, so a legal text had no
 * URL to share, to open in another tab or to be found by a crawler. They are links to the real
 * `/legal/*` routes now (FRESCO-493). They open in a new tab on purpose: the visitor is in the
 * middle of a form, and leaving it would lose what was typed. `LegalModal` stays in use where the
 * text is read in flow, next to the consent checkboxes.
 */

const LEGAL_LINKS = [
  { testId: 'legal_links_terms', label: 'Términos', href: '/legal/terminos' },
  { testId: 'legal_links_privacy', label: 'Privacidad', href: '/legal/privacidad' },
  { testId: 'legal_links_contact', label: 'Contacto', href: '/legal/contacto' },
  { testId: 'legal_links_cookies', label: 'Cookies', href: '/legal/cookies' },
] as const;

export function LegalLinks() {
  return (
    // FRESCO-478: text-body-sm (13px) not text-caption (11px) — AC bans
    // reading text below 12px; py-3 gives each link a ~44px tap target.
    <p className="mt-4 text-center text-body-sm text-tertiary [@media(max-height:700px)]:mt-2">
      {LEGAL_LINKS.map(({ testId, label, href }, index) => (
        <span key={href}>
          {index > 0 && ' · '}
          <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={testId}
            className="inline-block py-3 underline"
          >
            {label}
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </Link>
        </span>
      ))}
    </p>
  );
}
