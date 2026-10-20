import { afterEach, describe, expect, test } from 'bun:test';
import { POSTHOG_EVENTS } from './event-names';
import { committedMarkEvent, setAnalyticsTier, undoneMarkEvent } from './mark-events';

afterEach(() => setAnalyticsTier(null));

describe('mark events carry the plan tier (FRESCO-1031)', () => {
  test('recipe_marked_cooked, recipe_marked_discarded and recipe_mark_undone all send tier', () => {
    setAnalyticsTier('pro');

    expect(committedMarkEvent('cocinada', 'pendiente')).toEqual({ name: POSTHOG_EVENTS.RECIPE_MARKED_COOKED, properties: { tier: 'pro' } });
    expect(committedMarkEvent('descartada', 'pendiente')).toEqual({ name: POSTHOG_EVENTS.RECIPE_MARKED_DISCARDED, properties: { tier: 'pro' } });
    expect(committedMarkEvent('pendiente', 'cocinada')).toEqual({ name: POSTHOG_EVENTS.RECIPE_MARK_UNDONE, properties: { estado: 'cocinada', committed: true, tier: 'pro' } });
    expect(undoneMarkEvent('descartada')).toEqual({ name: POSTHOG_EVENTS.RECIPE_MARK_UNDONE, properties: { estado: 'descartada', tier: 'pro' } });
  });

  test('free is sent as free', () => {
    setAnalyticsTier('free');

    expect(committedMarkEvent('cocinada', 'pendiente').properties).toEqual({ tier: 'free' });
  });

  test('with no plan resolved the event goes out without tier, nothing else changes', () => {
    expect(committedMarkEvent('cocinada', 'pendiente').properties).toEqual({});
    expect(undoneMarkEvent('cocinada').properties).toEqual({ estado: 'cocinada' });
    expect('tier' in committedMarkEvent('pendiente', 'cocinada').properties).toBe(false);
  });

  test('no personal data: only estado, committed and tier ever appear', () => {
    setAnalyticsTier('family');
    const keys = [committedMarkEvent('pendiente', 'cocinada'), undoneMarkEvent('cocinada'), committedMarkEvent('descartada', 'pendiente')]
      .flatMap(event => Object.keys(event.properties));

    expect(new Set(keys)).toEqual(new Set(['estado', 'committed', 'tier']));
  });
});
