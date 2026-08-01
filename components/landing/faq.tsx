'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

const FAQS = [
  {
    question: '¿Necesito tarjeta para el plan Free?',
    answer: 'No. El plan Free es gratis para siempre, sin tarjeta. Solo necesitas un email.',
  },
  {
    question: '¿Qué pasa con mis alergias?',
    answer: 'Los filtros de alergias son absolutos. La IA nunca incluye un alérgeno declarado, bajo ninguna circunstancia.',
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

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="mx-auto max-w-5xl px-4 py-16 md:px-8">
      <h2 className="mb-6 text-h2 text-text">Preguntas frecuentes</h2>
      <div className="grid gap-x-12 md:grid-cols-2">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={faq.question} className="border-b border-border py-4">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${index}`}
                className="flex w-full items-start justify-between gap-4 text-left text-label text-text"
              >
                {faq.question}
                <Plus
                  className={cn(
                    'size-5 shrink-0 text-neutral-500 transition-transform',
                    isOpen && 'rotate-45 text-primary',
                  )}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <p id={`faq-answer-${index}`} className="mt-2 text-body-sm text-tertiary">
                  {faq.answer}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
