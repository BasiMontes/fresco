import { Tag } from '@/components/ui/tag';

export default function TagExample() {
  return (
    <div className="flex flex-wrap gap-2">
      <Tag>Vegetariano</Tag>
      <Tag variant="selected">Sin gluten</Tag>
      <Tag variant="outline">Rápido</Tag>
      <Tag variant="allergen">Contiene frutos secos</Tag>
    </div>
  );
}
