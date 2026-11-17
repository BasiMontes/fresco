import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function EmptyStateExample() {
  return (
    <EmptyState
      title="Todavía no hay menú"
      description="Genera tu primer menú semanal para empezar."
      action={<Button variant="action">Generar menú</Button>}
    />
  );
}
