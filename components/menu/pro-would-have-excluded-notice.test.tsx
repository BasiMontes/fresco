import type { MarkedDish } from '@/lib/menu/pro-would-have-excluded';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as posthogEvents from '@/lib/posthog/events';
import { fireEvent, renderWithProviders, screen } from '@/tests/component-render';
import { ProWouldHaveExcludedNotice } from './pro-would-have-excluded-notice';

const LENTEJAS: MarkedDish = { id: 'r1', nombre: 'Lentejas estofadas', estado: 'descartada' };
const TORTILLA: MarkedDish = { id: 'r2', nombre: 'Tortilla de patata', estado: 'cocinada' };

describe('ProWouldHaveExcludedNotice', () => {
  let capture: ReturnType<typeof spyOn>;
  beforeEach(() => { capture = spyOn(posthogEvents, 'captureEvent').mockImplementation(() => {}); });
  afterEach(() => { capture.mockRestore(); });

  test('without a matching dish it paints nothing and fires nothing', () => {
    renderWithProviders(<ProWouldHaveExcludedNotice dishes={[]} />);

    expect(screen.queryByTestId('pro_preview_notice')).toBeNull();
    expect(capture).not.toHaveBeenCalled();
  });

  test('says how many dishes, in the agreed words, and names them', () => {
    renderWithProviders(<ProWouldHaveExcludedNotice dishes={[LENTEJAS, TORTILLA]} />);

    expect(screen.getByTestId('pro_preview_notice_text')).toHaveTextContent('Con Pro, esta semana no habrías vuelto a ver 2 platos que marcaste en las últimas dos semanas.');
    expect(screen.getByTestId('pro_preview_notice_dishes')).toHaveTextContent('Lentejas estofadas, Tortilla de patata');
  });

  test('uses the singular for one dish', () => {
    renderWithProviders(<ProWouldHaveExcludedNotice dishes={[LENTEJAS]} />);

    expect(screen.getByTestId('pro_preview_notice_text')).toHaveTextContent('ver 1 plato que marcaste en las últimas dos semanas.');
  });

  test('links to the plan on /profile', () => {
    renderWithProviders(<ProWouldHaveExcludedNotice dishes={[LENTEJAS]} />);

    expect(screen.getByTestId('pro_preview_notice_link')).toHaveAttribute('href', '/profile');
  });

  test('fires pro_preview_shown once when it paints, with the number of dishes', () => {
    renderWithProviders(<ProWouldHaveExcludedNotice dishes={[LENTEJAS, TORTILLA]} />);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('pro_preview_shown', { platos: 2 });
  });

  test('fires pro_preview_clicked when the link is clicked', () => {
    renderWithProviders(<ProWouldHaveExcludedNotice dishes={[LENTEJAS]} />);

    fireEvent.click(screen.getByTestId('pro_preview_notice_link'));

    expect(capture).toHaveBeenCalledWith('pro_preview_clicked', { platos: 1 });
  });
});
