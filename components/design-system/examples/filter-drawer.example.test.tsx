import { fireEvent } from '@testing-library/react';
import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import FilterDrawerExample from './filter-drawer.example';

describe('filter drawer example (FRESCO-1235)', () => {
  test('its content has the same horizontal margin as the drawer header and footer, so the switch is not flush to the edge', () => {
    renderWithProviders(<FilterDrawerExample />);
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));

    const content = screen.getByTestId('filter_drawer_example_content');

    expect(content).toHaveClass('px-4');
    expect(content).toHaveTextContent('Solo recetas rápidas');
    expect(screen.getByRole('switch', { name: 'Solo recetas rápidas' })).toBeInTheDocument();
  });
});
