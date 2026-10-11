/**
 * Single source of truth for the landing FAQ content, shared by the visible
 * accordion (`components/landing/faq.tsx`) and the FAQPage JSON-LD it derives
 * (`app/page.tsx`, FRESCO-472).
 *
 * Kept in its own plain module (no `'use client'`) so a Server Component can
 * import it directly — importing a data export from a `'use client'` module
 * crosses the RSC client boundary and stops being a real array on the server
 * side (confirmed live: `faqs.map is not a function` when `FAQS` lived in
 * `faq.tsx` and `app/page.tsx` imported it).
 */
export const FAQS = [
  {
    question: '¿Necesito tarjeta para el plan Free?',
    answer: 'No. El plan Free es gratis para siempre, sin tarjeta. Solo necesitas un email.',
  },
  {
    question: '¿Qué pasa con mis alergias?',
    answer: 'Los filtros de alergias son absolutos. El sistema nunca incluye un alérgeno declarado, bajo ninguna circunstancia.',
  },
  {
    question: '¿Puedo cambiar recetas del menú?',
    answer: 'Sí. Puedes cambiar cualquier receta con un toque y regenerar solo ese slot sin tocar el resto.',
  },
  {
    question: '¿Funciona si somos veganos o celíacos?',
    answer: 'Sí, es uno de los casos más habituales. El sistema filtra por dieta antes de generar cualquier menú.',
  },
  {
    question: '¿Puedo cancelar cuando quiera?',
    answer: 'Sí, en cualquier momento desde tu perfil. Sin llamadas, sin formularios, sin excusas.',
  },
  {
    question: '¿Funciona para familias numerosas?',
    answer: 'Sí. Las cantidades de la lista de la compra se escalan automáticamente según el número de personas en tu hogar.',
  },
  {
    question: '¿Cuánto cuesta Fresco?',
    answer: 'El plan Free es gratis para siempre y no pide tarjeta. El plan Pro es una suscripción que se renueva sola, con 7 días de prueba. Puedes cancelar cuando quieras desde tu perfil y mantienes el acceso hasta el final del periodo ya pagado. El importe exacto lo ves en Stripe antes de confirmar.',
  },
  {
    question: '¿Qué haces con mis datos personales y de salud?',
    answer: 'Guardamos tu email, tu dieta, tus alergias y el tamaño de tu hogar. Las alergias son un dato de salud y las usamos solo con tu consentimiento, solo para excluirlas de tus menús. Los datos están alojados en la Unión Europea. Puedes acceder, corregir, exportar o borrar tu cuenta desde tu perfil.',
  },
  {
    question: '¿En qué se diferencia de un chat de IA o de otras apps de menús?',
    answer: 'Un chat de IA te contesta, pero no recuerda tus alergias de forma fiable ni te organiza la compra. En Fresco los filtros de alergias y de dieta se aplican antes de generar nada, y la lista sale ya ordenada por pasillos, con las cantidades escaladas a tu hogar. Cambias una receta sin rehacer toda la semana.',
  },
  {
    question: '¿Qué no hace Fresco todavía?',
    answer: 'Fresco no hace el pedido en el supermercado por ti. La lista incluye enlaces y precios orientativos de algunas cadenas, que pueden haber cambiado.',
  },
] as const;
