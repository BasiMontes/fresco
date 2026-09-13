'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { FAQS } from '@/components/landing/faq-data';
import { cn } from '@/lib/utils';

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
                // FRESCO-315: 44px comfortable tap target (was ~38px) — text/icon unchanged.
                className="flex min-h-[44px] w-full items-start justify-between gap-4 py-2 text-left text-label text-text"
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
