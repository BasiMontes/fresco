import { describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';

// `bun test` shares one process and `mock.module` is global, so this file pins its own `next/navigation`.
const nav = { pathname: '/design-system/foundation/colors' };
void mock.module('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, forward: () => {}, prefetch: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: () => {},
  notFound: () => {},
}));

const { DesignSystemNav } = await import('./nav');

describe('design-system nav', () => {
  test('marks only the link of the page being shown as current (FRESCO-1229)', () => {
    nav.pathname = '/design-system/foundation/colors';
    renderWithProviders(<DesignSystemNav />);

    expect(screen.getByRole('link', { name: 'Colores' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Tipografía' })).not.toHaveAttribute('aria-current');
    expect(screen.getAllByRole('link').filter(link => link.getAttribute('aria-current') === 'page')).toHaveLength(1);
  });
});
