import type { COMPONENT_APIS } from './generated';
import { testIdPart } from './test-id';

export interface PropsTableProps {
  slug: string
  api: (typeof COMPONENT_APIS)[keyof typeof COMPONENT_APIS]
}

export function PropsTable({ slug, api }: PropsTableProps) {
  return (
    <section data-testid={`design_system_props_${testIdPart(slug)}`} className="flex flex-col gap-4">
      <h2 className="text-h4">Propiedades</h2>
      {api.variants.length > 0 && (
        <ul className="flex flex-col gap-1 text-body-sm">
          {api.variants.map(({ name, values, default: fallback }) => (
            <li key={name}>
              <code>{name}</code>
              {': '}
              {values.join(', ')}
              {fallback !== null && <span className="text-tertiary">{` (por defecto: ${fallback})`}</span>}
            </li>
          ))}
        </ul>
      )}
      {api.extends.length > 0 && (
        <p className="text-body-sm text-tertiary">
          {'Extiende '}
          {api.extends.map(parent => <code key={parent} className="mr-1">{parent}</code>)}
        </p>
      )}
      {api.props.length > 0 && (
        <ul className="flex flex-col gap-1 text-body-sm">
          {api.props.map(({ name, type, optional }) => (
            <li key={name}>
              <code>{optional ? `${name}?` : name}</code>
              {': '}
              <code className="text-tertiary">{type}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
