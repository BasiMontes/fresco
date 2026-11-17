import type { RegistrySlug } from './registry';
import { CodeBlock } from '@/components/qa/code-block';
import { COMPONENT_APIS, EXAMPLE_SOURCES } from './generated';
import { PropsTable } from './props-table';
import { REGISTRY } from './registry';
import { testIdPart } from './test-id';

export interface ComponentPageProps {
  slug: RegistrySlug
}

export function ComponentPage({ slug }: ComponentPageProps) {
  const { title, description, Example } = REGISTRY[slug];
  return (
    <div data-testid={`design_system_component_${testIdPart(slug)}`} className="flex flex-col gap-6">
      <header>
        <h1 className="text-h2">{title}</h1>
        <p className="mt-2 text-body-md text-tertiary">{description}</p>
      </header>
      <div className="rounded-card border border-border bg-background p-6">
        <Example />
      </div>
      <CodeBlock code={EXAMPLE_SOURCES[slug]} lang="tsx" />
      <PropsTable slug={slug} api={COMPONENT_APIS[slug]} />
    </div>
  );
}
