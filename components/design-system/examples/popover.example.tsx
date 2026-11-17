'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';

export default function PopoverExample() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div>
      <Button ref={triggerRef} variant="secondary" onClick={() => setOpen(true)}>Ver detalles</Button>
      <Popover open={open} onOpenChange={setOpen} aria-label="Detalles de la receta" triggerRef={triggerRef} matchTriggerWidth={false}>
        <p className="p-4 text-body-sm text-text">Se prepara en 20 minutos y sirve para dos personas.</p>
      </Popover>
    </div>
  );
}
