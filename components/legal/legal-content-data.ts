/**
 * FRESCO-428 — cookie names/durations confirmed against real code:
 * `fresco_cookie_consent` (`lib/consent/cookie-consent.ts`), Supabase's
 * `@supabase/ssr` default naming convention (`sb-<project-ref>-auth-token`,
 * no override configured in `lib/supabase/client.ts`), and PostHog's own
 * documented default persistence key (`ph_<project_api_key>_posthog`,
 * confirmed via Context7 against `/posthog/posthog.com`).
 */
interface CookieTableRow {
  name: string
  provider: string
  purpose: string
  duration: string
  type: 'Técnica' | 'Analítica'
}

export const COOKIE_TABLE: CookieTableRow[] = [
  {
    name: 'fresco_cookie_consent',
    provider: 'Fresco',
    purpose: 'Recordar tu decisión sobre cookies',
    duration: '1 año',
    type: 'Técnica',
  },
  {
    name: 'sb-<ref>-auth-token',
    provider: 'Supabase',
    purpose: 'Mantener tu sesión iniciada',
    duration: 'Sesión / hasta expirar',
    type: 'Técnica',
  },
  {
    name: 'ph_<clave>_posthog',
    provider: 'PostHog',
    purpose: 'Analítica de uso — solo si aceptas',
    duration: '1 año',
    type: 'Analítica',
  },
  {
    name: '__ph_opt_in_out_<clave>',
    provider: 'PostHog',
    purpose: 'Recordar que rechazaste la analítica (localStorage)',
    duration: 'Hasta que cambies tu decisión',
    type: 'Técnica',
  },
];

/** FRESCO-51: real inbox — `hola.frescoapp@gmail.com` is the working Gmail address Supabase Auth itself sends from (no `@fresco.app` domain exists). Exported for FRESCO-429's subscription-confirmation email, which needs the same real contact address. */
export const CONTACT_EMAIL = 'hola.frescoapp@gmail.com';

interface LegalSubsection {
  title: string
  body: string
}

/** FRESCO-430: real titular, provided by the founder — Basilio Montes Castaño, autónomo (persona física), NIF 47427105R. Domicile is published as locality-only (Utrera, Sevilla, España) by the founder's explicit choice — a known LSSI gap (full street address) accepted over publishing a private home address, not an oversight. Founder has not registered as autónomo (RETA/Hacienda) yet — a separate business-registration concern the ticket explicitly scopes out of this fix. Exported for FRESCO-429's subscription-confirmation email (art. 98.7 requires the provider's identity in the same durable-support notice). */
export const LEGAL_ENTITY = 'Basilio Montes Castaño, autónomo, NIF 47427105R, con domicilio en Utrera (Sevilla), España, a efectos de notificaciones';

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
 * existed.
 *
 * FRESCO-430: the legal-entity gap from the original comment above is now
 * closed — see `LEGAL_ENTITY` above. The draft banner is gone.
 *
 * FRESCO-365 (non-lawyer technical review, course-project context — see
 * Jira comment for full scope note): closed the four gaps a real review
 * would flag first on a subscription service — withdrawal right (Ley
 * 3/2014 / TRLGDCU Art. 102-103, mandatory 14-day window + explicit
 * loss-of-right acknowledgment for digital services), auto-renewal /
 * cancellation disclosure for the Stripe Pro subscription (transparency
 * duty for recurring billing), a liability-cap carve-out for the mandatory
 * consumer-protection floor (Art. 86 TRLGDCU — a cap cannot shield willful
 * misconduct, gross negligence, or personal injury), and a fixed deletion
 * SLA + terms-change notice clause. DPO designation remains out of scope
 * (not mandatory at this processing scale).
 */
export const TERMS_SECTIONS: LegalSubsection[] = [
  {
    title: 'Aceptación de los Términos',
    body: `Al acceder y usar Fresco ("el Servicio"), operado por ${LEGAL_ENTITY}, aceptas estar sujeto/a a estos Términos de Servicio. Si no estás de acuerdo con alguna parte, no debes usar el Servicio.`,
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
    body: 'El Servicio se ofrece "tal cual". Los menús y recetas son sugerencias, no un consejo médico o nutricional profesional. Aunque Fresco excluye estructuralmente los alérgenos e ingredientes que declaras, sigues siendo responsable de verificar que cada receta es segura para tu hogar antes de cocinarla. En la medida permitida por la ley, la responsabilidad de Fresco frente a ti se limita a lo que hayas pagado por el Servicio en los últimos 12 meses. Esta limitación no aplica a daños causados por dolo o negligencia grave, ni a daños personales, ni a ningún otro supuesto en que la normativa de protección de consumidores no permita limitar la responsabilidad.',
  },
  {
    title: 'Suscripción, Renovación y Derecho de Desistimiento',
    body: 'El Plan Pro es una suscripción de pago recurrente gestionada por Stripe que se renueva automáticamente al final de cada periodo salvo que la canceles antes desde tu perfil; al cancelar, mantienes el acceso hasta el final del periodo ya pagado y no se te cobrará de nuevo. Si contratas el Plan Pro como consumidor en España o la UE, dispones de 14 días naturales desde la contratación para desistir sin justificar el motivo y con devolución íntegra del importe. Si nos pides expresamente empezar a prestarte el servicio antes de que termine ese plazo, entiendes que pierdes el derecho de desistimiento en el momento en que el servicio se haya ejecutado por completo; si se cancela antes de la ejecución completa, te devolvemos la parte proporcional no disfrutada.',
  },
  {
    title: 'Terminación',
    body: 'Puedes dejar de usar Fresco en cualquier momento y borrar tu cuenta desde tu perfil, lo que elimina tus datos según se describe en la Política de Privacidad. Nos reservamos el derecho de suspender cuentas que violen estos Términos.',
  },
  {
    title: 'Modificaciones de estos Términos',
    body: 'Podemos actualizar estos Términos ocasionalmente. Si el cambio es material, te avisaremos dentro de la aplicación o por correo electrónico con al menos 15 días de antelación a su entrada en vigor. Si sigues usando el Servicio después de esa fecha, se entiende que aceptas los nuevos Términos.',
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

export const PRIVACY_SECTIONS: LegalSubsection[] = [
  {
    title: 'Información que Recopilamos',
    body: 'Correo electrónico; tu dieta y restricciones (alergias, ingredientes que no te gustan — datos de categoría especial bajo el RGPD por su relación con la salud); cocinas favoritas; tamaño de tu hogar; presupuesto semanal; límites de tiempo de cocina; tu experiencia de cocina y objetivo; qué comidas del día quieres planificar; los menús y listas de la compra que generas; tus recetas propias y tus favoritos. Si marcas una receta como cocinada o descartada, registramos esa señal en todos los planes (más abajo, en "Cómo Usamos tu Información"). Si contratas el Plan Pro, también tratamos tus identificadores de cliente y de suscripción de Stripe. Con tu consentimiento, recogemos eventos de uso con fines de analítica y, si activas las notificaciones, tu suscripción push del navegador. Si ocurre un error técnico, registramos su traza para poder solucionarlo.',
  },
  {
    title: 'Base Legal para Datos de Alergias',
    body: 'Tratamos tu información de alergias e ingredientes a evitar únicamente con tu consentimiento explícito, otorgado al introducirlos en tu perfil — es un dato de categoría especial (Art. 9 RGPD) que usamos exclusivamente para excluir estructuralmente esas recetas de tus menús. Puedes retirar tu consentimiento borrando esos datos desde tu perfil en cualquier momento.',
  },
  {
    title: 'Cómo Usamos tu Información',
    body: 'Para generar tus menús semanales y tu lista de la compra, como parte del servicio que contratas (Art. 6.1.b RGPD). Registramos si marcas una receta como cocinada o descartada en todos los planes, no solo en Pro: en el Plan Free por nuestro interés legítimo en mejorar el catálogo (Art. 6.1.f, con derecho de oposición) y, además, en el Plan Pro para ajustar tus propios menús futuros como parte del servicio contratado (Art. 6.1.b). Con tu consentimiento (Art. 6.1.a) usamos también analítica de producto y notificaciones push. Para gestionar tu suscripción y facturación tratamos tus datos por ejecución del contrato y por obligación legal (Art. 6.1.b y 6.1.c).',
  },
  {
    title: 'Encargados del Tratamiento y Transferencias Internacionales',
    body: 'Para prestar el Servicio recurrimos, bajo contrato, a los siguientes proveedores tecnológicos (encargados del tratamiento): Supabase (base de datos y autenticación, alojado en la Unión Europea — Irlanda, con soporte desde EE. UU. amparado en cláusulas contractuales tipo); Stripe (procesamiento de pagos, en Irlanda y EE. UU., amparado en el Data Privacy Framework UE-EE. UU. y cláusulas contractuales tipo); PostHog (analítica de producto, alojado en la UE con acceso de soporte desde EE. UU., amparado en cláusulas contractuales tipo); Sentry (registro de errores técnicos, empresa con sede en EE. UU., amparado en el Data Privacy Framework y/o cláusulas contractuales tipo); Vercel (alojamiento del frontend, en EE. UU., amparado en el Data Privacy Framework); y, si activas las notificaciones, el proveedor de mensajería push de tu navegador (p. ej. Google/FCM, Mozilla o Apple), que solo recibe el endpoint cifrado necesario para entregarlas. No vendemos ni alquilamos tus datos personales, ni los compartimos con nadie más allá de estos proveedores necesarios para operar el Servicio.',
  },
  {
    title: 'Plazo de Conservación',
    body: 'Conservamos tus datos mientras tu cuenta esté activa. Si eres invitada (sesión anónima) y no conviertes tu sesión en una cuenta real, tus datos se eliminan automáticamente pasado un período de inactividad. Cuando borras tu cuenta, eliminamos tus datos personales de nuestros sistemas en un plazo máximo de 30 días, salvo la información de facturación que debamos conservar por obligación legal (normativa fiscal y contable española).',
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
