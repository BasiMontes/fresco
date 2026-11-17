import { Input } from '@/components/ui/input';

export default function InputExample() {
  return (
    <div className="flex max-w-sm flex-col gap-3">
      <Input type="email" placeholder="tu@correo.es" aria-label="Correo electrónico" />
      <Input type="number" defaultValue={4} aria-label="Comensales" />
      <Input disabled placeholder="Campo desactivado" aria-label="Campo desactivado" />
    </div>
  );
}
