import { Button } from '@/components/ui/button';

export default function ButtonExample() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Guardar menú</Button>
      <Button variant="action">Generar menú</Button>
      <Button variant="secondary">Cancelar</Button>
      <Button variant="ghost" size="sm">Saltar</Button>
      <Button disabled>No disponible</Button>
    </div>
  );
}
