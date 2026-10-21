'use client';

import { useEffect } from 'react';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';

/**
 * FRESCO-1027 — fires `learning_explanation_viewed` once when a Pro user's menu paints the explanation of what
 * it learned from their marks. Renders nothing; it sits beside the card so the card itself stays a Server Component.
 */
export function LearningExplanationViewed() {
  useEffect(() => {
    captureEvent(POSTHOG_EVENTS.LEARNING_EXPLANATION_VIEWED);
  }, []);

  return null;
}
