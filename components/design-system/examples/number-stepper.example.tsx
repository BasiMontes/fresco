'use client';

import { useState } from 'react';
import { NumberStepper } from '@/components/ui/number-stepper';

export default function NumberStepperExample() {
  const [adultos, setAdultos] = useState(2);

  return (
    <div className="flex flex-col items-start gap-3">
      <NumberStepper label="Adultos" data-testid="ds_adultos" min={1} max={10} value={adultos} onChange={setAdultos} />
      <p className="text-body-sm text-tertiary">Entre 1 y 10; los botones se desactivan en los límites.</p>
    </div>
  );
}
