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

/** Placeholder — no legal entity exists yet behind this Terms of Service (sole proprietor / autónomo / S.L. TBD). Must be filled with a real name + NIF/CIF before this stops being a draft — never fabricate one. */
const LEGAL_ENTITY_PLACEHOLDER = '[Titular del Servicio — nombre legal y NIF/CIF pendientes]';

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
 *
 * 2026-08-08 pass (non-lawyer content review, still a draft — see banner):
 * added the material gaps a real review would flag first — special-
 * category health data (alergias, GDPR Art. 9) had zero consent language;
 * no governing-law/jurisdiction clause existed at all; user-generated
 * content (`recetas_propias`, shipped since the original draft) had no
 * ownership/license clause; GDPR rights list was incomplete (missing
 * portability, objection, restriction, AEPD complaint right); no data
 * retention period was stated; no liability cap/warranty disclaimer
 * existed. The legal-entity gap from the original comment above is still
 * open — a placeholder, not a fabrication.
 */
const TERMS_SECTIONS: LegalSubsection[] = [
  {
    title: 'Aceptación de los Términos',
    body: `Al acceder y usar Fresco ("el Servicio"), operado por ${LEGAL_ENTITY_PLACEHOLDER}, aceptas estar sujeto/a a estos Términos de Servicio. Si no estás de acuerdo con alguna parte, no debes usar el Servicio.`,
  },
  {
    title: 'Descripción del Servicio',
    body: 'Fresco genera menús semanales personalizados a partir de tu dieta, alergias e ingredientes que no te gustan, produce una lista de la compra organizada por pasillo a partir de ese menú, y (Plan Pro) aprende de lo que realmente cocinas y descartas para ajustar futuros menús.',
  },
  {
    title: 'Cuentas de Usuario',
    body: 'Eres responsable de mantener la confidencialidad de tu cuenta. Al registrarte, aceptas usar el Servicio solo para fines personales y legales, y no intentar interferir con su funcionamiento. El Servicio no está dirigido a menores de 14 años.',
  },
  {
    title: 'Tu Contenido (Recetas Propias)',
    body: 'Las recetas que creas y guardas en tu biblioteca personal siguen siendo tuyas. Al crearlas, nos das una licencia limitada para almacenarlas y mostrártelas a ti dentro del Servicio — nunca las usamos para generar menús de otras personas ni las hacemos públicas.',
  },
  {
    title: 'Propiedad Intelectual de Fresco',
    body: 'El diseño, código y catálogo de recetas propio de Fresco son propiedad de Fresco (o de quien corresponda según la sección anterior, en el caso de tu contenido). No está permitida la ingeniería inversa ni la redistribución no autorizada del Servicio.',
  },
  {
    title: 'Limitación de Responsabilidad',
    body: 'El Servicio se ofrece "tal cual". Los menús y recetas son sugerencias, no un consejo médico o nutricional profesional. Aunque Fresco excluye estructuralmente los alérgenos e ingredientes que declaras, sigues siendo responsable de verificar que cada receta es segura para tu hogar antes de cocinarla. En la medida permitida por la ley, la responsabilidad de Fresco frente a ti se limita a lo que hayas pagado por el Servicio en los últimos 12 meses.',
  },
  {
    title: 'Terminación',
    body: 'Puedes dejar de usar Fresco en cualquier momento y borrar tu cuenta desde tu perfil, lo que elimina tus datos según se describe en la Política de Privacidad. Nos reservamos el derecho de suspender cuentas que violen estos Términos.',
  },
  {
    title: 'Ley Aplicable y Jurisdicción',
    body: 'Estos Términos se rigen por la legislación española. Para cualquier controversia, ambas partes se someten a los juzgados y tribunales de España, sin perjuicio de los derechos que la normativa de protección de consumidores te reconozca en tu lugar de residencia.',
  },
  {
    title: 'Contacto',
    body: `Si tienes preguntas sobre estos Términos, escríbenos a ${CONTACT_EMAIL}.`,
  },
];

const PRIVACY_SECTIONS: LegalSubsection[] = [
  {
    title: 'Información que Recopilamos',
    body: 'Correo electrónico, tu dieta y restricciones (alergias, ingredientes que no te gustan — datos de categoría especial bajo el RGPD por su relación con la salud), cocinas favoritas, y el tamaño de tu hogar. Si tienes Plan Pro, también qué recetas marcas como cocinadas o descartadas.',
  },
  {
    title: 'Base Legal para Datos de Alergias',
    body: 'Tratamos tu información de alergias e ingredientes a evitar únicamente con tu consentimiento explícito, otorgado al introducirlos en tu perfil — es un dato de categoría especial (Art. 9 RGPD) que usamos exclusivamente para excluir estructuralmente esas recetas de tus menús. Puedes retirar tu consentimiento borrando esos datos desde tu perfil en cualquier momento.',
  },
  {
    title: 'Cómo Usamos tu Información',
    body: 'Para generar tus menús semanales y tu lista de la compra, y — solo en Plan Pro — para que la generación de menús futuros tenga en cuenta lo que realmente cocinaste o descartaste. En Free, ese historial se registra igual pero nunca se aplica a tus propios menús.',
  },
  {
    title: 'Dónde se Almacenan tus Datos',
    body: 'Tus datos están almacenados en Supabase, en servidores ubicados en la Unión Europea (Irlanda), con las medidas de seguridad estándar de la industria. No vendemos, alquilamos ni compartimos tu información personal con terceros para fines comerciales.',
  },
  {
    title: 'Plazo de Conservación',
    body: 'Conservamos tus datos mientras tu cuenta esté activa. Si eres invitada (sesión anónima) y no conviertes tu sesión en una cuenta real, tus datos se eliminan automáticamente pasado un período de inactividad.',
  },
  {
    title: 'Tus Derechos',
    body: 'Puedes acceder, corregir, eliminar, exportar (portabilidad) o limitar el uso de tu información en cualquier momento desde tu perfil, o escribiéndonos directamente. También puedes oponerte a un tratamiento concreto y, si consideras que no hemos resuelto tu solicitud correctamente, presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD).',
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

      <div className="mt-4 text-body-md text-text">
        {(section === 'terminos' || section === 'privacidad') && (
          <div data-testid={`legal_modal_content_${section}`}>
            <p className="mb-4 rounded-md bg-warning/10 p-2 text-caption text-accent-2-700">
              Borrador — pendiente de revisión legal antes de producción.
            </p>
            <div className="flex flex-col gap-4">
              {(section === 'terminos' ? TERMS_SECTIONS : PRIVACY_SECTIONS).map(({ title, body }) => (
                <div key={title}>
                  <h3 className="text-label mb-1">{title}</h3>
                  {/* FRESCO-162 — bumped from text-tertiary (muted) to
                      inherit the parent's text-text: legal body copy is
                      primary content to read, not secondary metadata. */}
                  <p>{body}</p>
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
