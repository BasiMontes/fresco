import { describe, expect, it } from 'bun:test';
import { visibleDayCountFor } from '@/components/calendar/use-visible-day-window';

/**
 * FRESCO-786 (audit-6 A6-L2): the day count used to follow the VIEWPORT, so at
 * 768px (app sidebar = 256px) two 15rem columns were forced into a 442px
 * container and the page scrolled horizontally. It now follows the container.
 */
describe('visibleDayCountFor', () => {
  it('never returns less than one day, however narrow the container', () => {
    expect(visibleDayCountFor(0)).toBe(1);
    expect(visibleDayCountFor(120)).toBe(1);
  });

  it('shows two days once label + 2 columns + gaps fit (88 + 2 x 188 = 464)', () => {
    expect(visibleDayCountFor(463)).toBe(1);
    expect(visibleDayCountFor(464)).toBe(2);
  });

  it('FRESCO-970: shows at least five days in the 1120px content area at a 1440px viewport', () => {
    expect(visibleDayCountFor(1120)).toBeGreaterThanOrEqual(5);
  });

  it('FRESCO-970: shows two days in the ~640px left beside the icon rail at 768px', () => {
    expect(visibleDayCountFor(640)).toBe(2);
  });

  it('caps at the full week on very wide containers', () => {
    expect(visibleDayCountFor(3000)).toBe(7);
  });
});
