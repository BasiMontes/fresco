/** A box in viewport pixels, the shape `getBoundingClientRect()` returns for the fields used here. */
export interface TourRect {
  top: number
  left: number
  width: number
  height: number
}

interface PlaceCardInput {
  /** The zone the stop lifts, or `null` when there is none (the card is centred). */
  anchor: TourRect | null
  card: { width: number, height: number }
  viewport: { width: number, height: number }
  side: 'right' | 'below'
  /** Space kept free at the bottom of the viewport: the tab bar on a small screen. */
  bottomInset: number
}

const EDGE = 16;
const RING = 8;
const GAP = 16;

/**
 * FRESCO-1197: where the first-visit tour's step card goes, in viewport pixels. Next to the lifted zone,
 * never off screen, and centred when there is no zone. Pure so the geometry can be tested without a
 * browser; the component measures the zone and the card and calls this.
 *
 * `below`: centred on the zone, under it. With no room under it the card is pinned to the bottom and
 * overlaps the zone, which beats leaving the screen. `right`: beside a zone in the sidebar, nudged up so
 * a zone near the bottom does not push the card off screen.
 */
export function placeCard({ anchor, card, viewport, side, bottomInset }: PlaceCardInput): { left: number, top: number } {
  if (!anchor) {
    return {
      left: Math.max(EDGE, (viewport.width - card.width) / 2),
      top: Math.max(EDGE, (viewport.height - card.height) / 2 - 24),
    };
  }

  if (side === 'right') {
    return {
      left: Math.max(EDGE, anchor.left + anchor.width + GAP + RING),
      top: Math.max(EDGE, Math.min(anchor.top - RING, viewport.height - card.height - EDGE)),
    };
  }

  const centred = anchor.left + anchor.width / 2 - card.width / 2;
  const below = anchor.top + anchor.height + RING + GAP;
  const fits = below + card.height <= viewport.height - bottomInset;

  return {
    left: Math.max(EDGE, Math.min(centred, viewport.width - card.width - EDGE)),
    top: Math.max(EDGE, fits ? below : viewport.height - card.height - bottomInset),
  };
}
