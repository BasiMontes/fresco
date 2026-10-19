import {
  CONTACT_EMAIL,
  COOKIE_TABLE,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
} from '@/components/legal/legal-content-data';

/** Shared prose block for Términos/Privacidad — same JSX the modal used inline, extracted so `LegalModal` and the real `/legal/*` routes render identical content instead of two copies that can drift. */
/**
 * FRESCO-1013 (A7-UI-03): `headingLevel` follows the page. On `/legal/*` the page title is the `h1`, so the
 * sections are `h2`; inside `LegalModal` the dialog title is an `h2`, so they stay `h3`. Same visual class.
 */
export type SectionHeadingLevel = 'h2' | 'h3';

function SectionList({ sections, headingLevel }: { sections: { title: string, body: string }[], headingLevel: SectionHeadingLevel }) {
  const Heading = headingLevel;
  return (
    <div className="flex flex-col gap-4">
      {sections.map(({ title, body }) => (
        <div key={title}>
          <Heading className="text-label mb-1">{title}</Heading>
          <p>{body}</p>
        </div>
      ))}
    </div>
  );
}

export function TermsContent({ headingLevel = 'h3' }: { headingLevel?: SectionHeadingLevel }) {
  return (
    <div data-testid="legal_content_terminos">
      <SectionList sections={TERMS_SECTIONS} headingLevel={headingLevel} />
    </div>
  );
}

export function PrivacyContent({ headingLevel = 'h3' }: { headingLevel?: SectionHeadingLevel }) {
  return (
    <div data-testid="legal_content_privacidad">
      <SectionList sections={PRIVACY_SECTIONS} headingLevel={headingLevel} />
    </div>
  );
}

export function ContactContent() {
  return (
    <div data-testid="legal_content_contacto">
      <p>¿Alguna duda? Escríbenos directamente:</p>
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        data-testid="legal_contact_email_link"
        // FRESCO-940: stand-alone link, 44px tap target (WCAG 2.5.8 / 2.5.5).
        className="mt-2 inline-flex min-h-[44px] items-center text-primary underline"
      >
        {CONTACT_EMAIL}
      </a>
    </div>
  );
}

export function CookiesContent() {
  return (
    <div data-testid="legal_content_cookies">
      <p>Estas son las cookies que usa Fresco:</p>
      {/* FRESCO-1013 (A7-UI-02): at 360 px the table is wider than its box and scrolls inside it. A scroll
          region must take focus, or a keyboard user cannot reach the columns that are off-screen (WCAG 2.1.1). */}
      <div
        className="mt-4 overflow-x-auto"
        role="region"
        aria-label="Tabla de cookies"
        tabIndex={0}
      >
        <table data-testid="cookie_policy_table" className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-border text-label">
              <th className="py-2 pr-3">Nombre</th>
              <th className="py-2 pr-3">Proveedor</th>
              <th className="py-2 pr-3">Finalidad</th>
              <th className="py-2 pr-3">Duración</th>
              <th className="py-2">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {COOKIE_TABLE.map(row => (
              <tr key={row.name} className="border-b border-border last:border-0">
                {/* FRESCO-940: 13px, not the 11px caption — under the 12px floor. */}
                <td className="py-2 pr-3 font-mono text-body-sm">{row.name}</td>
                <td className="py-2 pr-3">{row.provider}</td>
                <td className="py-2 pr-3">{row.purpose}</td>
                <td className="py-2 pr-3">{row.duration}</td>
                <td className="py-2">{row.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
