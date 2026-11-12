import { describe, expect, test } from 'bun:test';
import { placeCard } from './place-card';

// FRESCO-1197 — where the tour's step card goes. It sits next to the lifted zone, never off screen,
// and is centred when there is no zone to lift. All values are viewport pixels.

const card = { width: 400, height: 260 };
const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

describe('placeCard', () => {
  test('is centred, a little above the middle, when there is no zone to lift', () => {
    expect(placeCard({ anchor: null, card, viewport: desktop, side: 'below', bottomInset: 24 })).toEqual({ left: 520, top: 296 });
  });

  test('never leaves the screen when it is centred on a viewport smaller than the card', () => {
    const result = placeCard({ anchor: null, card, viewport: { width: 300, height: 200 }, side: 'below', bottomInset: 24 });

    expect(result.left).toBe(16);
    expect(result.top).toBe(16);
  });

  test('goes below the zone, centred on it, with room between them', () => {
    const anchor = { top: 130, left: 380, width: 860, height: 200 };

    expect(placeCard({ anchor, card, viewport: desktop, side: 'below', bottomInset: 24 })).toEqual({ left: 610, top: 354 });
  });

  test('stays inside the right edge when the zone is near it', () => {
    const anchor = { top: 100, left: 1300, width: 120, height: 50 };

    const result = placeCard({ anchor, card, viewport: desktop, side: 'below', bottomInset: 24 });

    expect(result.left).toBe(1440 - 400 - 16);
  });

  test('stays inside the left edge when the zone is near it', () => {
    const anchor = { top: 100, left: 0, width: 40, height: 50 };

    const result = placeCard({ anchor, card, viewport: desktop, side: 'below', bottomInset: 24 });

    expect(result.left).toBe(16);
  });

  test('is pinned to the bottom, over the zone, when there is no room below it', () => {
    const anchor = { top: 400, left: 380, width: 860, height: 400 };

    const result = placeCard({ anchor, card, viewport: desktop, side: 'below', bottomInset: 24 });

    expect(result.top).toBe(900 - 260 - 24);
  });

  test('leaves the bottom inset free on a small screen so the card never covers the tab bar', () => {
    const anchor = { top: 70, left: 16, width: 358, height: 500 };

    const result = placeCard({ anchor, card: { width: 358, height: 260 }, viewport: mobile, side: 'below', bottomInset: 80 });

    expect(result.top).toBe(844 - 260 - 80);
  });

  test('goes to the right of the zone for a zone in the sidebar, a little above its top edge', () => {
    const anchor = { top: 300, left: 13, width: 174, height: 85 };

    expect(placeCard({ anchor, card, viewport: desktop, side: 'right', bottomInset: 24 })).toEqual({ left: 211, top: 292 });
  });

  test('a zone at the bottom of the sidebar keeps the card fully on screen', () => {
    const anchor = { top: 800, left: 13, width: 174, height: 85 };

    const result = placeCard({ anchor, card, viewport: desktop, side: 'right', bottomInset: 24 });

    expect(result.top + card.height).toBeLessThanOrEqual(900 - 16);
  });
});
