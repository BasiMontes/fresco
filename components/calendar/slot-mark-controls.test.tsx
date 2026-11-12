import { describe, expect, mock, test } from 'bun:test';
import { renderWithProviders, screen, setupUser, within } from '@/tests/component-render';
import { SlotChangeMarkControls, SlotEstadoBadge, SlotMarkControls } from './slot-mark-controls';

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

/**
 * FRESCO-1199 — the controls become icons over the photo. What the person sees is a small circle, but the
 * button box stays 44 px because the e2e step measures the element itself, and the word the icon stands for
 * opens beside it on hover and keyboard focus without replacing the accessible name.
 */
describe('SlotMarkControls as icons over the photo', () => {
  test('each button keeps a 44 px box', () => {
    renderWithProviders(<SlotMarkControls dia="lunes" tipo="cena" nombre="Sopa" pending={false} onMark={() => {}} />);

    for (const id of ['calendar_slot_lunes_cena_mark_cocinada', 'calendar_slot_lunes_cena_mark_descartada']) {
      const classes = screen.getByTestId(id).className;
      expect(classes).toContain('h-11');
      expect(classes).toContain('min-w-11');
    }
  });

  test('the word is drawn inside the button but hidden from assistive technology, so the name stays the aria-label', () => {
    renderWithProviders(<SlotMarkControls dia="lunes" tipo="cena" nombre="Sopa" pending={false} onMark={() => {}} />);

    const word = within(screen.getByTestId('calendar_slot_lunes_cena_mark_cocinada')).getByText('Cocinado');
    expect(word.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: 'Cocinado: Sopa, lunes, cena' })).toBeInTheDocument();
  });

  test('both buttons are disabled while a mark is being saved', () => {
    renderWithProviders(<SlotMarkControls dia="lunes" tipo="cena" nombre="Sopa" pending onMark={() => {}} />);

    expect(screen.getByTestId('calendar_slot_lunes_cena_mark_cocinada')).toBeDisabled();
    expect(screen.getByTestId('calendar_slot_lunes_cena_mark_descartada')).toBeDisabled();
  });
});

describe('SlotChangeMarkControls accessible names', () => {
  test('on a cooked dish: "Quitar marca" and "Cambiar a descartado", each naming the dish, the day and the meal', () => {
    renderWithProviders(<SlotChangeMarkControls dia="lunes" tipo="cena" nombre="Sopa" estado="cocinada" pending={false} onMark={() => {}} />);

    expect(screen.getByTestId('calendar_slot_lunes_cena_unmark').getAttribute('aria-label')).toBe('Quitar marca: Sopa, lunes, cena');
    expect(screen.getByTestId('calendar_slot_lunes_cena_switch').getAttribute('aria-label')).toBe('Cambiar a descartado: Sopa, lunes, cena');
  });

  test('on a discarded dish the switch offers "cocinado"', () => {
    renderWithProviders(<SlotChangeMarkControls dia="lunes" tipo="cena" nombre="Sopa" estado="descartada" pending={false} onMark={() => {}} />);

    expect(screen.getByTestId('calendar_slot_lunes_cena_switch').getAttribute('aria-label')).toBe('Cambiar a cocinado: Sopa, lunes, cena');
  });

  test('each name starts with the word the button can show', () => {
    renderWithProviders(<SlotChangeMarkControls dia="lunes" tipo="cena" nombre="Sopa" estado="cocinada" pending={false} onMark={() => {}} />);

    expect(screen.getByTestId('calendar_slot_lunes_cena_unmark').getAttribute('aria-label')!.startsWith('Quitar')).toBe(true);
    expect(screen.getByTestId('calendar_slot_lunes_cena_switch').getAttribute('aria-label')!.startsWith('Cambiar')).toBe(true);
  });

  test('"Quitar marca" puts the slot back to pending and the switch flips the mark', async () => {
    const onMark = mock(() => {});
    const user = setupUser();
    renderWithProviders(<SlotChangeMarkControls dia="lunes" tipo="cena" nombre="Sopa" estado="cocinada" pending={false} onMark={onMark} />);

    await user.click(screen.getByTestId('calendar_slot_lunes_cena_unmark'));
    expect(onMark).toHaveBeenLastCalledWith('pendiente');

    await user.click(screen.getByTestId('calendar_slot_lunes_cena_switch'));
    expect(onMark).toHaveBeenLastCalledWith('descartada');
  });

  test('both buttons keep a 44 px box', () => {
    renderWithProviders(<SlotChangeMarkControls dia="lunes" tipo="cena" nombre="Sopa" estado="cocinada" pending={false} onMark={() => {}} />);

    for (const id of ['calendar_slot_lunes_cena_unmark', 'calendar_slot_lunes_cena_switch']) {
      expect(screen.getByTestId(id).className).toContain('h-11');
      expect(screen.getByTestId(id).className).toContain('min-w-11');
    }
  });
});

describe('SlotEstadoBadge as a chip over the photo', () => {
  test('says exactly "Cocinado" or "Descartado": the e2e steps read this text', () => {
    const { unmount } = renderWithProviders(<SlotEstadoBadge dia="lunes" tipo="cena" estado="cocinada" />);
    expect(screen.getByTestId('calendar_slot_lunes_cena_estado_badge').textContent).toBe('Cocinado');
    unmount();

    renderWithProviders(<SlotEstadoBadge dia="lunes" tipo="cena" estado="descartada" />);
    expect(screen.getByTestId('calendar_slot_lunes_cena_estado_badge').textContent).toBe('Descartado');
  });
});
