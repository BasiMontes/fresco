import { Clock, ListChecks, Repeat } from 'lucide-react';

// FRESCO-370 (A4-H13/H16): this section used to show invented figures
// ("~300€ menos", "25% menos desperdicio", "30 min") under a line claiming
// they were "estimaciones basadas en hábitos reales en España" — no such
// source exists (see the sibling note in components/menu/savings-estimate-cards.tsx).
// Replaced with three statements about how the product actually works, each
// verifiable against the app itself.
const HIGHLIGHTS = [
  {
    icon: Clock,
    value: 'En 30 segundos',
    description: 'Tu menú completo de lunes a domingo, sin pensar qué cocinar.',
  },
  {
    icon: Repeat,
    value: 'Sin repetir',
    description: 'No vuelven las recetas de las últimas semanas. En Pro, además aprende de lo que cocinas.',
  },
  {
    icon: ListChecks,
    value: 'Lista ya hecha',
    description: 'La compra agrupada por pasillos del súper. Marca lo que ya tienes y sal de casa.',
  },
] as const;

export function ImpactStats() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 text-center md:px-8">
      <h2 className="text-h2 text-primary">
        Lo que Fresco hace por ti
        <span className="text-accent-2-700">.</span>
      </h2>
      <p className="mx-auto mb-10 mt-2 max-w-md text-body-md text-tertiary">
        Tres cosas concretas, cada semana.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {HIGHLIGHTS.map(({ icon: Icon, value, description }) => (
          <div
            key={value}
            className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface p-6"
          >
            <span className="grid size-14 place-items-center rounded-full bg-accent-2-100">
              <Icon className="size-6 text-accent-2-700" strokeWidth={2} />
            </span>
            <p className="text-h3 text-primary">{value}</p>
            <p className="text-body-sm text-tertiary">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
