import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { STRIPE_API_VERSION } from './stripe-api-version';

// FRESCO-1268. The Stripe pin lives in three places that Dependabot only half watches: the app's `stripe`
// in package.json, the Edge Functions' own `stripe` in supabase/functions/deno.json, and the API version
// constant on each side. Bumping one without the others is what turned a routine update into a red CI.

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('the Stripe pin', () => {
  test('is the API version the installed SDK was generated against', () => {
    expect(read('node_modules/stripe/esm/apiVersion.js')).toContain(`'${STRIPE_API_VERSION}'`);
  });

  test('is the one the Edge Functions pin too, so the app and the Edge call speak one version', () => {
    expect(read('supabase/functions/_shared/stripe-billing.ts')).toContain(`const STRIPE_API_VERSION = '${STRIPE_API_VERSION}'`);
  });

  test('the Edge Functions import the same stripe SDK version as the app', () => {
    const app = (JSON.parse(read('package.json')) as { dependencies: { stripe: string } }).dependencies.stripe.replace(/^[\^~]/, '');
    const edge = (JSON.parse(read('supabase/functions/deno.json')) as { imports: { stripe: string } }).imports.stripe;

    expect(edge).toBe(`npm:stripe@${app}`);
  });
});
