import type { PosthogEventName } from './event-names';
import { POSTHOG_EVENTS } from './event-names';

/**
 * FRESCO-1031: the plan tier on the dish-mark events, so PostHog can split Pro from Free behaviour
 * (`menu_generation_completed` already carries it, FRESCO-366).
 *
 * No network read per mark: `PostHogProvider` already reads the plan once to identify the person and
 * records it here. It is `null` until that read lands and for a visitor who never accepted cookies; the
 * event then goes out without `tier` and the mark works the same. A plan that changes mid-session (an
 * upgrade, a pilot grant) shows from the next page load, when the provider identifies again.
 */
export type AnalyticsTier = 'free' | 'pro' | 'family';

let knownTier: AnalyticsTier | null = null;

export function setAnalyticsTier(tier: AnalyticsTier | null): void {
  knownTier = tier;
}

export interface MarkEvent {
  name: PosthogEventName
  properties: Record<string, unknown>
}

const tierProperties = (): { tier?: AnalyticsTier } => (knownTier ? { tier: knownTier } : {});

/** The event for a mark the server accepted. `pendiente` is a committed mark taken back. */
export function committedMarkEvent(estado: 'cocinada' | 'descartada' | 'pendiente', prevEstado: string): MarkEvent {
  if (estado === 'pendiente') {
    return { name: POSTHOG_EVENTS.RECIPE_MARK_UNDONE, properties: { estado: prevEstado, committed: true, ...tierProperties() } };
  }
  return {
    // "usados" half of the North-star KPI (ADR-0013); discard rate per menu is a quality metric (FRESCO-366).
    name: estado === 'cocinada' ? POSTHOG_EVENTS.RECIPE_MARKED_COOKED : POSTHOG_EVENTS.RECIPE_MARKED_DISCARDED,
    properties: tierProperties(),
  };
}

/** The "Deshacer" tap inside the undo window, before the mark ever reached the server. */
export function undoneMarkEvent(estado: string): MarkEvent {
  return { name: POSTHOG_EVENTS.RECIPE_MARK_UNDONE, properties: { estado, ...tierProperties() } };
}
