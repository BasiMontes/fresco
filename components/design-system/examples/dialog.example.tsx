'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

export default function DialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Abrir diálogo</Button>
      <Dialog open={open} onOpenChange={setOpen} aria-label="Eliminar receta">
        <div className="flex flex-col gap-4 p-6">
          <p className="text-body text-text">¿Seguro que quieres eliminar esta receta?</p>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
        </div>
      </Dialog>
    </div>
  );
}
