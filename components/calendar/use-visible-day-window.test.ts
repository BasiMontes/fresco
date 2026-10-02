import { describe, expect, it } from 'bun:test';
import { visibleDayCountFor } from '@/components/calendar/use-visible-day-window';

/**
 * FRESCO-786 (audit-6 A6-L2): the day count used to follow the VIEWPORT, so at
 * 768px (app sidebar = 256px) two 15rem columns were forced into a 442px
 * container and the page scrolled horizontally. It now follows the container.
 */
describe('visibleDayCountFor', () => {
  it('shows one day in the 442px content area left at a 768px viewport', () => {
    expect(visibleDayCountFor(442)).toBe(1);
  });

  it('never returns less than one day, however narrow the container', () => {
    expect(visibleDayCountFor(0)).toBe(1);
    expect(visibleDayCountFor(120)).toBe(1);
  });

  it('shows two days once label + 2 columns + gaps fit (88 + 2 x 252 = 592)', () => {
    expect(visibleDayCountFor(591)).toBe(1);
    expect(visibleDayCountFor(592)).toBe(2);
    expect(visibleDayCountFor(704)).toBe(2);
  });

  it('shows three days once label + 3 columns + gaps fit (88 + 3 x 252 = 844)', () => {
    expect(visibleDayCountFor(843)).toBe(2);
    expect(visibleDayCountFor(844)).toBe(3);
  });

  it('caps at three days on very wide containers', () => {
    expect(visibleDayCountFor(2000)).toBe(3);
  });
});
