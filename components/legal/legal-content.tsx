import {
  CONTACT_EMAIL,
  COOKIE_TABLE,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
} from '@/components/legal/legal-content-data';

/** Shared prose block for Términos/Privacidad — same JSX the modal used inline, extracted so `LegalModal` and the real `/legal/*` routes render identical content instead of two copies that can drift. */
function SectionList({ sections }: { sections: { title: string, body: string }[] }) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map(({ title, body }) => (
        <div key={title}>
          <h3 className="text-label mb-1">{title}</h3>
          <p>{body}</p>
        </div>
      ))}
    </div>
  );
}

export function TermsContent() {
  return (
    <div data-testid="legal_content_terminos">
      <SectionList sections={TERMS_SECTIONS} />
    </div>
  );
}

export function PrivacyContent() {
  return (
    <div data-testid="legal_content_privacidad">
      <SectionList sections={PRIVACY_SECTIONS} />
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
        className="mt-2 inline-block text-primary underline"
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
      <div className="mt-4 overflow-x-auto">
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
                <td className="py-2 pr-3 font-mono text-caption">{row.name}</td>
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
