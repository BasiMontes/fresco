import { describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { SlotMarkControls } from './slot-mark-controls';

/**
 * FRESCO-1013 (A7-UI-05, WCAG 2.5.3 Label in Name) — the mark buttons say the word they show first, and name
 * the dish and the slot, so a voice-control user can say "pulsa Descartar" and a screen-reader user does not
 * hear twenty-one identical buttons.
 */
describe('SlotMarkControls accessible names', () => {
  test('each name starts with the visible word and carries the dish, the day and the meal', () => {
    renderWithProviders(<SlotMarkControls dia="miercoles" tipo="comida" nombre="Lentejas estofadas" pending={false} onMark={() => {}} />);

    const cocinado = screen.getByTestId('calendar_slot_miercoles_comida_mark_cocinada');
    const descartar = screen.getByTestId('calendar_slot_miercoles_comida_mark_descartada');

    expect(cocinado.textContent).toContain('Cocinado');
    expect(cocinado.getAttribute('aria-label')).toBe('Cocinado: Lentejas estofadas, miércoles, comida');
    expect(descartar.textContent).toContain('Descartar');
    expect(descartar.getAttribute('aria-label')).toBe('Descartar: Lentejas estofadas, miércoles, comida');
    for (const button of [cocinado, descartar]) {
      const visible = (button.textContent ?? '').trim();
      expect(button.getAttribute('aria-label')!.startsWith(visible)).toBe(true);
    }
  });

  test('two slots do not share a name', () => {
    renderWithProviders(
      <>
        <SlotMarkControls dia="lunes" tipo="desayuno" nombre="Tostada" pending={false} onMark={() => {}} />
        <SlotMarkControls dia="martes" tipo="desayuno" nombre="Tostada" pending={false} onMark={() => {}} />
      </>,
    );

    const names = screen.getAllByRole('button').map(button => button.getAttribute('aria-label'));
    expect(new Set(names).size).toBe(names.length);
  });

  test('without a dish name the slot still identifies the button', () => {
    renderWithProviders(<SlotMarkControls dia="lunes" tipo="cena" pending={false} onMark={() => {}} />);

    expect(screen.getByRole('button', { name: 'Descartar: lunes, cena' })).toBeInTheDocument();
  });

  test('still marks on click', async () => {
    const onMark = mock(() => {});
    const user = setupUser();
    renderWithProviders(<SlotMarkControls dia="lunes" tipo="cena" nombre="Sopa" pending={false} onMark={onMark} />);

    await user.click(screen.getByRole('button', { name: 'Descartar: Sopa, lunes, cena' }));

    expect(onMark).toHaveBeenCalledWith('descartada');
  });
});
