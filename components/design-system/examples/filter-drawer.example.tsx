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
        {/* FRESCO-1235: the drawer body has no padding of its own (header and footer carry `p-4`); content brings its own horizontal margin, as the recipe library's FilterSection does. */}
        <div data-testid="filter_drawer_example_content" className="flex items-center gap-3 px-4 py-2 text-body-sm text-text">
          <Switch checked={quick} onCheckedChange={setQuick} aria-label="Solo recetas rápidas" />
          Solo recetas rápidas
        </div>
      </FilterDrawer>
    </div>
  );
}
