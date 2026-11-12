import { describe, expect, test } from 'bun:test';
import { shouldAutoStartTour } from './should-auto-start';

// FRESCO-1197 — when the first-visit tour opens by itself. Owner decision (2026-11-12): registered
// accounts only, once, after the profile onboarding. Anything else leaves it closed.

const eligible = { isAnonymous: false, profileExists: true, seen: false, missingConsents: 0 };

describe('shouldAutoStartTour', () => {
  test('opens for a registered account that finished onboarding and has not seen it', () => {
    expect(shouldAutoStartTour(eligible)).toBe(true);
  });

  test('never opens for a guest', () => {
    expect(shouldAutoStartTour({ ...eligible, isAnonymous: true })).toBe(false);
  });

  test('does not open again once it was seen, skipped or closed', () => {
    expect(shouldAutoStartTour({ ...eligible, seen: true })).toBe(false);
  });

  test('does not open before the profile onboarding is finished', () => {
    expect(shouldAutoStartTour({ ...eligible, profileExists: false })).toBe(false);
  });

  test('does not open on top of the dialog that asks for the terms again', () => {
    expect(shouldAutoStartTour({ ...eligible, missingConsents: 1 })).toBe(false);
  });
});
