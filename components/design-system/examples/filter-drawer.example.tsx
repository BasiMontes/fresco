'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FilterDrawer } from '@/components/ui/filter-drawer';
import { Switch } from '@/components/ui/switch';

export default function FilterDrawerExample() {
  const [open, setOpen] = useState(false);
  const [quick, setQuick] = useState(false);

  return (
    <div>
      <Button variant="secondary" onClick={() => setOpen(true)}>Filtros</Button>
      <FilterDrawer
        open={open}
        onOpenChange={setOpen}
        title="Filtros"
        aria-label="Filtros de recetas"
        hasActiveFilters={quick}
        onClearAll={() => setQuick(false)}
        footer={<Button onClick={() => setOpen(false)}>Aplicar</Button>}
      >
        <div className="flex items-center gap-3 text-body-sm text-text">
          <Switch checked={quick} onCheckedChange={setQuick} aria-label="Solo recetas rápidas" />
          Solo recetas rápidas
        </div>
      </FilterDrawer>
    </div>
  );
}
