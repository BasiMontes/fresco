import { Clock, TrendingDown, Wallet } from 'lucide-react';

const STATS = [
  {
    icon: Clock,
    value: '30 min',
    label: 'Ahorrados cada semana',
    description: 'En planificación del menú y preparación de la lista de la compra',
  },
  {
    icon: Wallet,
    value: '~300€',
    label: 'Menos en compras anuales',
    description: 'Evitando compras impulsivas y alimentos que acaban en la basura',
  },
  {
    icon: TrendingDown,
    value: '25%',
    label: 'Menos desperdicio',
    description: 'De alimentos en tu hogar al comprar solo lo que realmente vas a cocinar',
  },
] as const;

export function ImpactStats() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 text-center md:px-8">
      <h2 className="text-h2 text-primary">
        Tu impacto con Fresco
        <span className="text-accent-2-700">.</span>
      </h2>
      <p className="mx-auto mb-10 mt-2 max-w-md text-body-md text-tertiary">
        Estimaciones basadas en hábitos reales de planificación alimentaria en España.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {STATS.map(({ icon: Icon, value, label, description }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface p-6"
          >
            <span className="grid size-14 place-items-center rounded-full bg-accent-2-100">
              <Icon className="size-6 text-accent-2-700" strokeWidth={2} />
            </span>
            <p className="text-h2 text-primary">{value}</p>
            <div>
              <p className="text-label text-text">{label}</p>
              <p className="mt-1 text-body-sm text-tertiary">{description}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-caption italic text-tertiary">
        * Estimaciones orientativas. Los resultados varían según el hogar y los hábitos previos.
      </p>
    </section>
  );
}
