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
] as const;
