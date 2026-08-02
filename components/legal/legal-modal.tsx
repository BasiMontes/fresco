'use client';

import { Dialog } from '@/components/ui/dialog';

export type LegalSection = 'terminos' | 'privacidad' | 'contacto';

const SECTION_LABEL: Record<LegalSection, string> = {
  terminos: 'Términos de Servicio',
  privacidad: 'Política de Privacidad',
  contacto: 'Contacto',
};

/** FRESCO-51: real inbox — `hola.frescoapp@gmail.com` is the working Gmail address Supabase Auth itself sends from (no `@fresco.app` domain exists). */
const CONTACT_EMAIL = 'hola.frescoapp@gmail.com';

interface LegalSubsection {
  title: string
  body: string
}

/**
 * Adapted from an earlier iteration's legal copy (a private prior repo,
 * `frescoapp`, found while researching real text to replace the original
 * one-paragraph placeholder). Not verbatim — corrected against this app's
 * actual current scope before reuse:
 * - Dropped the fictional office address and "Fresco App Inc." — no such
 *   entity or office exists; a fabricated one would be worse than none.
 * - Dropped "integraciones con supermercados" and meal-reminder
 *   notifications — neither exists, and supermarket integrations are
 *   explicitly on `business-model.md`'s Out-of-Scope Blacklist.
 * - Contact is the real Gmail address, not the fabricated `@fresco.app` one
 *   the source repo used.
 * Still explicitly placeholder pending real legal review (DoD) — adapting
 * draft copy is not the same as having counsel review it.
 */
const TERMS_SECTIONS: LegalSubsection[] = [
  {
    title: 'Aceptación de los Términos',
    body: 'Al acceder y usar Fresco ("el Servicio"), aceptas estar sujeto/a a estos Términos de Servicio. Si no estás de acuerdo con alguna parte, no debes usar el Servicio.',
  },
  {
    title: 'Descripción del Servicio',
    body: 'Fresco genera menús semanales personalizados a partir de tu dieta, alergias e ingredientes que no te gustan, produce una lista de la compra organizada por pasillo a partir de ese menú, y (Plan Pro) aprende de lo que realmente cocinas y descartas para ajustar futuros menús.',
  },
  {
    title: 'Cuentas de Usuario',
    body: 'Eres responsable de mantener la confidencialidad de tu cuenta. Al registrarte, aceptas usar el Servicio solo para fines personales y legales, y no intentar interferir con su funcionamiento.',
  },
  {
    title: 'Propiedad Intelectual',
    body: 'El diseño, código y contenido generado por Fresco son propiedad de Fresco. No está permitida la ingeniería inversa ni la redistribución no autorizada del Servicio.',
  },
  {
    title: 'Limitación de Responsabilidad',
    body: 'Los menús y recetas son sugerencias, no un consejo médico o nutricional profesional. Aunque Fresco excluye estructuralmente los alérgenos e ingredientes que declaras, sigues siendo responsable de verificar que cada receta es segura para tu hogar antes de cocinarla.',
  },
  {
    title: 'Terminación',
    body: 'Puedes dejar de usar Fresco en cualquier momento. Nos reservamos el derecho de suspender cuentas que violen estos Términos.',
  },
  {
    title: 'Contacto',
    body: `Si tienes preguntas sobre estos Términos, escríbenos a ${CONTACT_EMAIL}.`,
  },
];

const PRIVACY_SECTIONS: LegalSubsection[] = [
  {
    title: 'Información que Recopilamos',
    body: 'Correo electrónico, tu dieta y restricciones (alergias, ingredientes que no te gustan), cocinas favoritas, y el tamaño de tu hogar. Si tienes Plan Pro, también qué recetas marcas como cocinadas o descartadas.',
  },
  {
    title: 'Cómo Usamos tu Información',
    body: 'Para generar tus menús semanales y tu lista de la compra, y — solo en Plan Pro — para que la generación de menús futuros tenga en cuenta lo que realmente cocinaste o descartaste. En Free, ese historial se registra igual pero nunca se aplica a tus propios menús.',
  },
  {
    title: 'Protección de Datos',
    body: 'Tus datos están almacenados en Supabase con las medidas de seguridad estándar de la industria. No vendemos, alquilamos ni compartimos tu información personal con terceros para fines comerciales.',
  },
  {
    title: 'Tus Derechos',
    body: 'Puedes acceder, corregir o eliminar tu información en cualquier momento desde tu perfil, o escribiéndonos directamente.',
  },
  {
    title: 'Contacto',
    body: `Si tienes preguntas sobre esta Política de Privacidad o quieres ejercer tus derechos, escríbenos a ${CONTACT_EMAIL}.`,
  },
];

export interface LegalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: LegalSection
}

/**
 * FRESCO-51 — Términos de Servicio / Política de Privacidad / Contacto, each
 * its own standalone modal (no shared tab switcher between them — a caller
 * that wants a different document closes this one and opens the other
 * trigger, e.g. `LegalLinks`' three separate links). Wider on desktop
 * (`sm:max-w-2xl` vs `Dialog`'s own `max-w-lg` default) — legal text reads
 * better with more line width than the general-purpose default allows.
 *
 * Contacto is a static email + `mailto:` link, no form, no backend —
 * confirmed with the user before this story's AC was written (a working
 * contact form was explicitly descoped).
 */
export function LegalModal({ open, onOpenChange, section }: LegalModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      aria-label={SECTION_LABEL[section]}
      data-testid="legal_modal"
      className="sm:max-w-2xl"
    >
      <h2 className="text-h4 pr-8">{SECTION_LABEL[section]}</h2>

      <div className="mt-4 text-body-sm text-text">
        {(section === 'terminos' || section === 'privacidad') && (
          <div data-testid={`legal_modal_content_${section}`}>
            <p className="mb-4 rounded-md bg-warning/10 p-2 text-caption text-warning">
              Borrador — pendiente de revisión legal antes de producción.
            </p>
            <div className="flex flex-col gap-4">
              {(section === 'terminos' ? TERMS_SECTIONS : PRIVACY_SECTIONS).map(({ title, body }) => (
                <div key={title}>
                  <h3 className="text-label mb-1">{title}</h3>
                  <p className="text-tertiary">{body}</p>
                </div>
              ))}
            </div>
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
