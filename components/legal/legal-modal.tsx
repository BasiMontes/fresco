'use client';

import { Dialog } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';

export type LegalSection = 'terminos' | 'privacidad' | 'contacto';

const SECTION_OPTIONS = [
  { value: 'terminos', label: 'Términos' },
  { value: 'privacidad', label: 'Privacidad' },
  { value: 'contacto', label: 'Contacto' },
] as const;

const SECTION_LABEL: Record<LegalSection, string> = {
  terminos: 'Términos de Servicio',
  privacidad: 'Política de Privacidad',
  contacto: 'Contacto',
};

/** FRESCO-51: real inbox — `hola.frescoapp@gmail.com` is the working Gmail address Supabase Auth itself sends from (no `@fresco.app` domain exists). */
const CONTACT_EMAIL = 'hola.frescoapp@gmail.com';

export interface LegalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: LegalSection
  onSectionChange: (section: LegalSection) => void
}

/**
 * FRESCO-51 — Términos de Servicio / Política de Privacidad / Contacto as one
 * modal with a tab switch, so a caller can deep-link straight to the section
 * that's relevant to it (e.g. FRESCO-53's registro checkbox opens straight to
 * `terminos` from its own link, `privacidad` from its own — same modal,
 * different `section`).
 *
 * Términos/Privacidad render clearly-marked PLACEHOLDER copy — the real
 * legal text is a business/legal responsibility, explicitly Out-of-Scope on
 * this story (DoD: "revisado por el negocio antes de producción"). Contacto
 * is a static email + `mailto:` link, no form, no backend — confirmed with
 * the user before this story's AC was written (a working contact form was
 * explicitly descoped).
 */
export function LegalModal({ open, onOpenChange, section, onSectionChange }: LegalModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-label={SECTION_LABEL[section]} data-testid="legal_modal">
      <h2 className="text-h4 pr-8">{SECTION_LABEL[section]}</h2>

      <SegmentedControl
        options={[...SECTION_OPTIONS]}
        value={section}
        onChange={value => onSectionChange(value as LegalSection)}
        aria-label="Elegir documento"
        className="mt-3"
      />

      <div className="mt-4 text-body-sm text-text">
        {section === 'terminos' && (
          <div data-testid="legal_modal_content_terminos">
            <p className="mb-3 rounded-md bg-warning/10 p-2 text-caption text-warning">
              Contenido de ejemplo — pendiente de revisión legal antes de producción.
            </p>
            <p>
              Al usar Fresco, aceptas que generamos menús semanales a partir de la información
              que nos das (dieta, alergias, ingredientes que no te gustan) y que el resultado es
              una sugerencia, no un consejo médico o nutricional profesional. Eres responsable de
              verificar que cada receta es segura para tu hogar antes de cocinarla.
            </p>
          </div>
        )}

        {section === 'privacidad' && (
          <div data-testid="legal_modal_content_privacidad">
            <p className="mb-3 rounded-md bg-warning/10 p-2 text-caption text-warning">
              Contenido de ejemplo — pendiente de revisión legal antes de producción.
            </p>
            <p>
              Guardamos los datos que nos das durante el registro (dieta, alergias, ingredientes
              que no te gustan, tamaño del hogar) para generar tus menús y, si tienes Plan Pro,
              para aprender de lo que cocinas y descartas. No vendemos tus datos a terceros.
            </p>
          </div>
        )}

        {section === 'contacto' && (
          <div data-testid="legal_modal_content_contacto">
            <p>¿Alguna duda? Escríbenos directamente:</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              data-testid="legal_modal_contact_email_link"
              className="mt-2 inline-block text-primary underline"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        )}
      </div>
    </Dialog>
  );
}
