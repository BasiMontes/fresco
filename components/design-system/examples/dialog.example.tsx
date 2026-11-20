'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

export default function DialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Abrir diálogo</Button>
      <Dialog open={open} onOpenChange={setOpen} aria-label="Confirmar eliminación">
        <div className="flex flex-col gap-4 p-6">
          <p className="text-body-md text-text">¿Seguro que quieres eliminar esta receta?</p>
          <div className="flex gap-3">
            <Button onClick={() => setOpen(false)}>Eliminar</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
