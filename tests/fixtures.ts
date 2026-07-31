import type { Request as PlaywrightRequest } from '@playwright/test';
import { test as base } from 'playwright-bdd';

/**
 * Single shared custom `test` instance for every step file that needs
 * per-scenario state. playwright-bdd generates ONE spec file per `.feature`
 * file and requires a single, unambiguous test instance for it — two
 * independent `base.extend()` calls in different step files (as
 * signup.steps.ts and aprendizaje.steps.ts each had) are siblings, not a
 * chain, and `bddgen` refuses to guess between them ("Found 2 test
 * instances, but they should extending each other"). Every step file that
 * needs shared state across its own Given/When/Then imports `test` from
 * here instead of calling `base.extend()` itself.
 */

export interface SignupCtx {
  email: string
  password: string
  signupRequest: Promise<PlaywrightRequest>
}

export interface AprendizajeCtx {
  slotPrefix: string
}

export const test = base.extend<{ signupCtx: SignupCtx, aprendizajeCtx: AprendizajeCtx }>({
  // eslint-disable-next-line no-empty-pattern
  signupCtx: async ({}, use) => {
    await use({} as SignupCtx);
  },
  // eslint-disable-next-line no-empty-pattern
  aprendizajeCtx: async ({}, use) => {
    await use({} as AprendizajeCtx);
  },
});
