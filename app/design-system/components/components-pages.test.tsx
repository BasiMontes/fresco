import { describe, expect, mock, test } from 'bun:test';
import { COMPONENT_APIS, EXAMPLE_SOURCES } from '@/components/design-system/generated';
import { DesignSystemNav } from '@/components/design-system/nav';
import { REGISTRY, registrySlugs } from '@/components/design-system/registry';
import { renderWithProviders, screen } from '@/tests/component-render';

// Shiki makes CodeBlock an async Server Component, which the client test renderer cannot mount.
void mock.module('@/components/qa/code-block', () => ({
  CodeBlock: ({ code }: { code: string }) => <pre data-testid="code_block">{code}</pre>,
}));
// Other test files stub next/navigation globally; the real notFound throws, so pin that here.
void mock.module('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
}));

const { default: DesignSystemComponentPage, generateStaticParams } = await import('./[slug]/page');

// FRESCO-1207 (PR 4 of 6): the component pages render the registry, the generated API and the example source.
describe('design-system component pages', () => {
  test('every registry entry has a generated API and an example source that imports its real component', () => {
    for (const slug of registrySlugs()) {
      expect(COMPONENT_APIS).toHaveProperty([slug]);
      expect(EXAMPLE_SOURCES[slug]).toContain(`@/components/ui/${REGISTRY[slug].source}`);
    }
    expect(generateStaticParams()).toEqual(registrySlugs().map(slug => ({ slug })));
  });

  test('every example renders without error', () => {
    for (const slug of registrySlugs()) {
      const { Example } = REGISTRY[slug];
      const { container, unmount } = renderWithProviders(<Example />);
      expect(container.firstElementChild).not.toBeNull();
      unmount();
    }
  });

  test('the [slug] page renders the button docs: example, props table and variants', async () => {
    renderWithProviders(await DesignSystemComponentPage({ params: Promise.resolve({ slug: 'button' }) }) as React.ReactElement);

    expect(screen.getByTestId('design_system_component_button')).toBeInTheDocument();
    expect(screen.getByTestId('design_system_props_button')).toHaveTextContent('variant: default, action');
    expect(screen.getByRole('button', { name: 'Guardar menú' })).toBeInTheDocument();
  });

  test('the [slug] page calls notFound for an unknown slug', async () => {
    await expect(DesignSystemComponentPage({ params: Promise.resolve({ slug: 'nope' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  test('nav links every registry component and the Foundation pages', () => {
    renderWithProviders(<DesignSystemNav />);

    for (const slug of registrySlugs()) {
      expect(screen.getByRole('link', { name: REGISTRY[slug].title })).toHaveAttribute('href', `/design-system/components/${slug}`);
    }
    expect(screen.getByRole('link', { name: 'Colores' })).toHaveAttribute('href', '/design-system/foundation/colors');
  });
});
