import { afterEach, describe, expect, it } from 'bun:test';
import { useVisibleDayWindow, visibleDayCountFor } from '@/components/calendar/use-visible-day-window';
import { act, renderHook, waitFor } from '@/tests/component-render';

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

/**
 * FRESCO-1014 (A7-UI-13): on a phone the single visible column opens on today when the viewed week is the
 * current one. The hook measures its container with a ResizeObserver, so the test gives it one.
 */
describe('useVisibleDayWindow — opens on today', () => {
  const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
  const realObserver = globalThis.ResizeObserver;

  afterEach(() => {
    globalThis.ResizeObserver = realObserver;
  });

  function withWidth(width: number) {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
    return { current: { clientWidth: width } as HTMLElement };
  }

  it('starts on the focus day when a single column fits (360 px phone)', async () => {
    const { result } = renderHook(() => useVisibleDayWindow([...DIAS], { containerRef: withWidth(360), focusDia: 'viernes' }));

    await waitFor(() => expect(result.current.visibleDays).toEqual(['viernes']));
    expect(result.current.canGoPrevDay).toBe(true);
  });

  it('starts on Monday when the viewed week is not the current one (no focus day)', async () => {
    const { result } = renderHook(() => useVisibleDayWindow([...DIAS], { containerRef: withWidth(360) }));

    await waitFor(() => expect(result.current.visibleDays).toEqual(['lunes']));
  });

  it('does not move when the whole week fits', async () => {
    const { result } = renderHook(() => useVisibleDayWindow([...DIAS], { containerRef: withWidth(3000), focusDia: 'viernes' }));

    await waitFor(() => expect(result.current.visibleDays).toHaveLength(7));
    expect(result.current.hasDayOverflow).toBe(false);
  });

  it('opens on the focus day only once: paging away is not undone', async () => {
    const container = withWidth(360);
    const { result } = renderHook(() => useVisibleDayWindow([...DIAS], { containerRef: container, focusDia: 'viernes' }));
    await waitFor(() => expect(result.current.visibleDays).toEqual(['viernes']));

    act(() => result.current.setStartIndex(0));

    expect(result.current.visibleDays).toEqual(['lunes']);
  });

  it('a focus day the household does not plan falls back to the first planned day', async () => {
    const { result } = renderHook(() => useVisibleDayWindow(['lunes', 'martes', 'miercoles'], { containerRef: withWidth(360), focusDia: 'viernes' }));

    await waitFor(() => expect(result.current.visibleDays).toEqual(['lunes']));
  });
});
