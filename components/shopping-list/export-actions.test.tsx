import type { ShoppingListPasillo } from '@/lib/api/types';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { ExportActions } from '@/components/shopping-list/export-actions';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';

const PASILLOS: ShoppingListPasillo[] = [
  {
    nombre: 'Frutas y verduras',
    orden: 1,
    items: [{ nombre: 'tomate', cantidad: 3, unidad: 'unidades', comprado: false }],
  },
];

/**
 * happy-dom's `navigator`/`URL` are shared across every test FILE in the
 * suite (one DOM registered once in `bun-test-setup.ts`'s preload, not
 * per-file) — an un-restored `Object.defineProperty` override here leaks
 * into whichever file bun schedules next and was observed corrupting
 * unrelated `document.cookie` assertions in `components/legal/*.test.tsx`
 * when the full suite ran. Every stub below is undone in `afterEach`.
 */
const restoreFns: (() => void)[] = [];

afterEach(() => {
  while (restoreFns.length > 0) { restoreFns.pop()!(); }
});

/** happy-dom no implementa `navigator.clipboard` — se stubea per test, restaurado en `afterEach`. */
function stubClipboard() {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writeText = mock(async () => {});
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  restoreFns.push(() => {
    if (original) { Object.defineProperty(navigator, 'clipboard', original); }
    else { delete (navigator as { clipboard?: unknown }).clipboard; }
  });
  return writeText;
}

/** happy-dom no implementa `URL.createObjectURL`/`revokeObjectURL` — se stubean per test, restaurados en `afterEach`. */
function stubObjectUrl() {
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const createObjectURL = mock(() => 'blob:mock-url');
  const revokeObjectURL = mock(() => {});
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
  restoreFns.push(() => {
    if (originalCreate) { Object.defineProperty(URL, 'createObjectURL', originalCreate); }
    else { delete (URL as { createObjectURL?: unknown }).createObjectURL; }
    if (originalRevoke) { Object.defineProperty(URL, 'revokeObjectURL', originalRevoke); }
    else { delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL; }
  });
  return { createObjectURL, revokeObjectURL };
}

/**
 * `handleDownload` calls a real `anchor.click()` on a temporary `<a
 * download>`. happy-dom's `.click()` on a `download`-anchor runs its own
 * internal navigation/download machinery — observed corrupting unrelated
 * `document.cookie` writes in OTHER test files later in the same full-suite
 * run (this DOM is process-wide, not per-file). The component under test
 * only needs `.click()` to have been called; stubbing it out avoids that
 * happy-dom side effect entirely, restored in `afterEach`.
 */
function stubAnchorClick() {
  // Stored only to be written straight back onto the prototype in
  // `afterEach`, never called directly.
  // eslint-disable-next-line ts/unbound-method
  const original = HTMLAnchorElement.prototype.click;
  const click = mock(() => {});
  HTMLAnchorElement.prototype.click = click;
  restoreFns.push(() => {
    HTMLAnchorElement.prototype.click = original;
  });
  return click;
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
    const anchorClick = stubAnchorClick();

    await user.click(screen.getByTestId('shopping_list_export_download_button'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('disables Copiar/Descargar for an empty list, but keeps the open-app links active', () => {
    renderWithProviders(<ExportActions pasillos={[]} />);

    expect(screen.getByTestId('shopping_list_export_copy_button')).toBeDisabled();
    expect(screen.getByTestId('shopping_list_export_download_button')).toBeDisabled();
    expect(screen.getByTestId('shopping_list_export_open_mercadona_link')).not.toHaveAttribute('disabled');
  });
});
