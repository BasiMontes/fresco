'use client';

import { useState } from 'react';
import { Dropdown } from '@/components/ui/dropdown';

const OPTIONS = [
  { value: 'lunch', label: 'Comida' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Merienda' },
];

export default function DropdownExample() {
  const [meal, setMeal] = useState<string | null>(null);

  return <Dropdown options={OPTIONS} value={meal} onChange={setMeal} aria-label="Tipo de comida" />;
}
