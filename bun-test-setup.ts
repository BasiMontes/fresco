import { mock } from 'bun:test';

/**
 * posthog-js's browser bundle attaches DOM listeners at import time
 * (autocapture bootstrap) and crashes under Bun's test runner on Linux CI
 * (`t.addEventListener is not a function`) even though it's silent locally.
 * lib/posthog/events.test.ts only asserts our own fail-soft wrapper, never
 * real SDK behavior (see that file's own docstring) — a lightweight stub is
 * the correct fix, not a DOM shim.
 */
void mock.module('posthog-js', () => ({
  default: {
    capture: () => ({ uuid: '', event: '', properties: {} }),
    identify: () => {},
    alias: () => {},
    get_distinct_id: () => null,
    init: () => {},
  },
}));
