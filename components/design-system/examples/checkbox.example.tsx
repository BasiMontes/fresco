'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export default function CheckboxExample() {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-3 text-body-sm text-text">
        <Checkbox checked={accepted} onChange={event => setAccepted(event.target.checked)} />
        Acepto los términos del servicio
      </label>
      <p className="text-body-sm text-tertiary">{accepted ? 'Marcada' : 'Sin marcar'}</p>
      <label className="flex items-center gap-3 text-body-sm text-text">
        <Checkbox disabled />
        Opción desactivada
      </label>
    </div>
  );
}
