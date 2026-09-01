import type { Request as PlaywrightRequest } from '@playwright/test';
import type { TestUser, TestUserFactory } from './test-user-factory';
import { test as base } from 'playwright-bdd';
import { createTestUserFactory } from './test-user-factory';

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
  /** FRESCO-356: the scenario's own throwaway factory user, so @aprendizaje no longer shares the DEV_USER meal plan (which blocked parallel execution). */
  testUser: TestUser
}

export interface SuscripcionCtx {
  checkoutSessionId: string
  /** FRESCO-308: the scenario's own throwaway test user ("Laura"), created by its first Given step and reused by every later Given/When/Then in the same scenario — replaces the shared `PRO_USER_EMAIL` account. */
  testUser: TestUser
  /** FRESCO-376: every real Stripe test-mode Customer a `@requiere-stripe-real` step creates — the `suscripcionCtx` fixture teardown deletes them so CI/staging runs don't accumulate orphan customers on the Stripe account. Stays empty (no-op teardown) for the webhook-only scenarios and for `bun run test:e2e`, which excludes `@requiere-stripe-real`. */
  stripeCustomerIds: string[]
}

export const test = base.extend<{ signupCtx: SignupCtx, aprendizajeCtx: AprendizajeCtx, suscripcionCtx: SuscripcionCtx, testUserFactory: TestUserFactory }>({
  // eslint-disable-next-line no-empty-pattern
  signupCtx: async ({}, use) => {
    await use({} as SignupCtx);
  },
  // eslint-disable-next-line no-empty-pattern
  aprendizajeCtx: async ({}, use) => {
    await use({} as AprendizajeCtx);
  },
  // eslint-disable-next-line no-empty-pattern
  suscripcionCtx: async ({}, use) => {
    const ctx = { stripeCustomerIds: [] } as unknown as SuscripcionCtx;
    await use(ctx);
    // FRESCO-376: teardown runs pass or fail (Playwright fixture guarantee).
    // Empty for webhook-only scenarios and for `bun run test:e2e` (which
    // excludes `@requiere-stripe-real`), so this is a no-op there — the
    // Stripe client is only constructed when there is something to delete.
    if (ctx.stripeCustomerIds.length > 0) {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-07-29.dahlia' });
      for (const id of ctx.stripeCustomerIds) {
        await stripe.customers.del(id).catch(() => { /* best-effort cleanup — a failed delete must not fail the run */ });
      }
    }
  },
  // FRESCO-308: per-test data factory (`tests/test-user-factory.ts`) —
  // replaces the shared `DEV_USER_EMAIL`/`PRO_USER_EMAIL` accounts for
  // scenarios that write to `meal_plans`/`user_profiles`. Teardown runs
  // after `await use(...)` regardless of the test's outcome (Playwright
  // fixture guarantee), so every user a scenario creates via `factory()` is
  // deleted whether the scenario passes or fails — no step file has to
  // remember to clean up after itself.
  testUserFactory: async ({ request }, use) => {
    const { factory, cleanupAll } = createTestUserFactory(request);
    await use(factory);
    await cleanupAll();
  },
});
