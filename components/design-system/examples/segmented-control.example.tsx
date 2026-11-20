'use client';

import { useState } from 'react';
import { SegmentedControl } from '@/components/ui/segmented-control';

const OPTIONS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
];

export default function SegmentedControlExample() {
  const [period, setPeriod] = useState('week');

  return (
    <div className="flex flex-col items-start gap-3">
      <SegmentedControl options={OPTIONS} value={period} onChange={setPeriod} aria-label="Periodo del menú" />
      <p className="text-body-sm text-tertiary">
        Seleccionado:
        {' '}
        {period}
      </p>
    </div>
  );
}
