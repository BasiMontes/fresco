'use client';

import { useState } from 'react';
import { OptionCardGroup } from '@/components/ui/option-card-group';

const OPTIONS = [
  { value: 'sencillo', label: 'Sencillo', description: 'Platos rápidos de pocos pasos.' },
  { value: 'variado', label: 'Variado', description: 'Un poco de todo durante la semana.' },
  { value: 'elaborado', label: 'Elaborado', description: 'Recetas con más técnica.' },
  { value: 'libre', label: 'Sin preferencia' },
];

export default function OptionCardGroupExample() {
  const [value, setValue] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-3">
      <OptionCardGroup options={OPTIONS} value={value} onChange={setValue} aria-label="Estilo de cocina" className="w-full max-w-md" />
      <p className="text-body-sm text-tertiary">
        Seleccionado:
        {' '}
        {value ?? 'ninguno'}
      </p>
    </div>
  );
}
