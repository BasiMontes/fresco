'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';

export default function SwitchExample() {
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-body-sm text-text">
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Recibir avisos por correo" />
        Recibir avisos por correo
      </div>
      <p className="text-body-sm text-tertiary">{enabled ? 'Activado' : 'Desactivado'}</p>
      <div className="flex items-center gap-3 text-body-sm text-text">
        <Switch checked={false} onCheckedChange={() => {}} disabled aria-label="Modo experimental" />
        Modo experimental
      </div>
    </div>
  );
}
