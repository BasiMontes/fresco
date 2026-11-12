import { describe, expect, test } from 'bun:test';
import { getTourStops } from './tour-stops';

// FRESCO-1197 — the five stops of the first-visit tour, in the order the owner ratified (2026-11-12):
// menu, calendar, recipes, shopping list, plan. Each stop opens the page it explains.

describe('getTourStops', () => {
  test('has five stops in the ratified order, each opening its own page', () => {
    const stops = getTourStops('free');

    expect(stops.map(stop => stop.path)).toEqual(['/menu', '/calendar', '/recipes', '/shopping-list', '/profile']);
    expect(stops.map(stop => stop.id)).toEqual(['menu', 'calendar', 'recipes', 'list', 'plan']);
  });

  test('every stop names a distinct zone of its page and has a title and a body', () => {
    const stops = getTourStops('free');

    expect(new Set(stops.map(stop => stop.anchor)).size).toBe(stops.length);
    for (const stop of stops) {
      expect(stop.title.trim().length).toBeGreaterThan(0);
      expect(stop.body.trim().length).toBeGreaterThan(0);
    }
  });

  test('only the plan stop has no zone to lift on a small screen: its zone lives in the desktop sidebar', () => {
    const stops = getTourStops('free');

    expect(stops.filter(stop => !stop.anchoredOnMobile).map(stop => stop.id)).toEqual(['plan']);
  });

  test('the plan stop sits beside its zone, every other stop sits below it', () => {
    const stops = getTourStops('free');

    expect(stops.filter(stop => stop.placement === 'right').map(stop => stop.id)).toEqual(['plan']);
  });

  test('the plan stop says marks are stored but not applied on Free', () => {
    const plan = getTourStops('free').find(stop => stop.id === 'plan');

    expect(plan?.body).toContain('En Free tus marcas se guardan igual, pero no se aplican a tus menús.');
  });

  test('Pro and Family do not read a sentence that does not apply to them', () => {
    for (const plan of ['pro', 'family'] as const) {
      const stop = getTourStops(plan).find(candidate => candidate.id === 'plan');

      expect(stop?.body).not.toContain('En Free');
      expect(stop?.body).toContain('Con tu plan Pro');
    }
  });

  test('only the plan stop changes with the plan', () => {
    const free = getTourStops('free').filter(stop => stop.id !== 'plan');
    const pro = getTourStops('pro').filter(stop => stop.id !== 'plan');

    expect(pro).toEqual(free);
  });

  test('copy is Spanish from Spain: no voseo and no em dash', () => {
    const text = getTourStops('free').map(stop => `${stop.title} ${stop.body}`).join(' ');

    expect(text).not.toMatch(/\b(tenés|querés|podés|hacé|marcá|abrí)\b/i);
    expect(text).not.toContain('—');
  });
});
