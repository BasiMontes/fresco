import type { ShoppingListPasillo } from '@/lib/api/types';
import { describe, expect, it, mock } from 'bun:test';
import { ExportActions } from '@/components/shopping-list/export-actions';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';

const PASILLOS: ShoppingListPasillo[] = [
  {
    nombre: 'Frutas y verduras',
    orden: 1,
    items: [{ nombre: 'tomate', cantidad: 3, unidad: 'unidades', comprado: false }],
  },
];

/** happy-dom no implementa `navigator.clipboard` — se stubea per test. */
function stubClipboard() {
  const writeText = mock(async () => {});
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

/** happy-dom no implementa `URL.createObjectURL`/`revokeObjectURL`. */
function stubObjectUrl() {
  const createObjectURL = mock(() => 'blob:mock-url');
  const revokeObjectURL = mock(() => {});
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
  return { createObjectURL, revokeObjectURL };
}

describe('ExportActions (FRESCO-345)', () => {
  it('renders the 3 open-app links with correct href/target/rel', () => {
    renderWithProviders(<ExportActions pasillos={PASILLOS} />);

    const mercadona = screen.getByTestId('shopping_list_export_open_mercadona_link');
    const carrefour = screen.getByTestId('shopping_list_export_open_carrefour_link');
    const dia = screen.getByTestId('shopping_list_export_open_dia_link');

    expect(mercadona).toHaveAttribute('href', 'https://www.mercadona.es');
    expect(carrefour).toHaveAttribute('href', 'https://www.carrefour.es');
    expect(dia).toHaveAttribute('href', 'https://www.dia.es');

    for (const link of [mercadona, carrefour, dia]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('"Copiar" writes the formatted text to the clipboard and shows "Copiado"', async () => {
    const user = setupUser();
    renderWithProviders(<ExportActions pasillos={PASILLOS} />);
    // Stubbed AFTER render — happy-dom's `render()` (re)installs its own
    // real `Clipboard` on `navigator`, clobbering a stub set earlier.
    const writeText = stubClipboard();

    await user.click(screen.getByTestId('shopping_list_export_copy_button'));

    expect(writeText).toHaveBeenCalledWith('FRUTAS Y VERDURAS\n- 3 unidades Tomate');
    expect(screen.getByTestId('shopping_list_export_copy_button')).toHaveTextContent('Copiado');
  });

  it('"Descargar" creates and revokes an object URL for the CSV blob', async () => {
    const user = setupUser();
    renderWithProviders(<ExportActions pasillos={PASILLOS} />);
    const { createObjectURL, revokeObjectURL } = stubObjectUrl();

    await user.click(screen.getByTestId('shopping_list_export_download_button'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('disables Copiar/Descargar for an empty list, but keeps the open-app links active', () => {
    renderWithProviders(<ExportActions pasillos={[]} />);

    expect(screen.getByTestId('shopping_list_export_copy_button')).toBeDisabled();
    expect(screen.getByTestId('shopping_list_export_download_button')).toBeDisabled();
    expect(screen.getByTestId('shopping_list_export_open_mercadona_link')).not.toHaveAttribute('disabled');
  });
});
