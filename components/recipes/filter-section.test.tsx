import type { ComponentProps } from 'react';
import type { FilterSectionOption } from './filter-section';
import { describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { FilterSection } from './filter-section';

/**
 * FRESCO-409 — `FilterSection` is the collapsible facet inside
 * `FilterDrawer`. Tests pin the disclosure toggle, the selected-count
 * suffix on the label, and that each checkbox reflects `selected` and
 * routes clicks through `onToggle`.
 */

const OPTIONS: FilterSectionOption[] = [
  { value: 'vegana', label: 'Vegana' },
  { value: 'sin-gluten', label: 'Sin gluten' },
];

function render(props: Partial<ComponentProps<typeof FilterSection>> = {}) {
  return renderWithProviders(
    <FilterSection
      label="Dieta"
      options={OPTIONS}
      selected={[]}
      onToggle={mock(() => {})}
      countFor={() => 3}
      data-testid="facet_dieta"
      {...props}
    />,
  );
}

describe('FilterSection', () => {
  test('is collapsed by default and expands on click', async () => {
    const user = setupUser();
    render();

    expect(screen.queryByText('Vegana')).toBeNull();
    expect(screen.getByTestId('facet_dieta')).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByTestId('facet_dieta'));

    expect(screen.getByText('Vegana')).toBeInTheDocument();
    expect(screen.getByTestId('facet_dieta')).toHaveAttribute('aria-expanded', 'true');
  });

  test('starts open when defaultOpen is set', () => {
    render({ defaultOpen: true });
    expect(screen.getByText('Sin gluten')).toBeInTheDocument();
  });

  test('appends the selected count to the label', () => {
    render({ selected: ['vegana', 'sin-gluten'] });
    expect(screen.getByTestId('facet_dieta')).toHaveTextContent('Dieta (2)');
  });

  test('reflects selected options and forwards toggles', async () => {
    const user = setupUser();
    const onToggle = mock(() => {});
    render({ selected: ['vegana'], onToggle, defaultOpen: true });

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();

    await user.click(checkboxes[1]);
    expect(onToggle).toHaveBeenCalledWith('sin-gluten');
  });

  test('shows the per-option result count', () => {
    render({ countFor: value => (value === 'vegana' ? 12 : 0), defaultOpen: true });
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
