import { mock } from 'bun:test';

/**
 * `lib/env.ts` validates the NEXT_PUBLIC_* client env at first read and
 * throws "copy .env.example to .env" when unset. `bun test` auto-loads a
 * local `.env`, so it is silent locally — but CI's `test:unit` job has no
 * `.env`, which broke the 12 `lib/api/edge-functions.test.ts` cases (they
 * read `process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL` for their own
 * assertions). Deterministic dummies, only when nothing real is present.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL ||= 'https://test.functions.supabase.co';

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
