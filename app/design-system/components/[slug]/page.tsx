import type { RegistrySlug } from '@/components/design-system/registry';
import { notFound } from 'next/navigation';
import { ComponentPage } from '@/components/design-system/component-page';
import { REGISTRY, registrySlugs } from '@/components/design-system/registry';

export function generateStaticParams() {
  return registrySlugs().map(slug => ({ slug }));
}

export default async function DesignSystemComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!Object.hasOwn(REGISTRY, slug)) { notFound(); }
  return <ComponentPage slug={slug as RegistrySlug} />;
}
