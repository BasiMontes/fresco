#!/usr/bin/env bun
/**
 * Stripe Billing Portal configuration check: `bunx varlock run -- bun scripts/qa/stripe-portal-config.ts [--fail-on-drift]`
 * (`bun run qa:stripe-portal`).
 *
 * FRESCO-1289 (audit 11 F5, owner decision of 2026-11-25). Two manual scenarios of `.context/qa/regression.feature`,
 * "Cancelar la suscripción" and "Ver mi próximo cobro", happen inside Stripe's hosted Billing Portal. There is no code
 * of ours to assert: what can break is the portal configuration in the Stripe dashboard (a cancellation that turns
 * immediate, an invoice history that is switched off). Our portal sessions are created without a `configuration`
 * (`app/api/stripe/portal/route.ts`), so the account's DEFAULT configuration is what a customer gets.
 *
 * This script reads that configuration, read-only (one `list` call, nothing is created or changed), and checks:
 *   1. there is an active default configuration;
 *   2. cancelling is enabled and takes effect at the end of the paid period (`at_period_end`);
 *   3. the invoice history is enabled.
 * The portal configuration is separate in test mode and in live mode: run it with the key of the mode you want to
 * vouch for. The key is read by name from the environment and never printed; only the mode (test or live) is.
 *
 * A NOTICE: the exit code is 0 unless `--fail-on-drift` is passed. Project-owned: `bun run up` does not overwrite it.
 */

import process from 'node:process';
import picocolors from 'picocolors';
import Stripe from 'stripe';
import { STRIPE_API_VERSION } from '../../lib/stripe-api-version';

// Colour only for a person at a terminal (picocolors would colour a pipe whenever `CI` is set).
const pc = picocolors.createColors(Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);

/** The slice of a portal configuration these checks read, so the rule is testable without the Stripe SDK. */
export interface PortalConfigurationShape {
  id: string
  is_default: boolean
  active: boolean
  features: {
    subscription_cancel?: { enabled?: boolean, mode?: string }
    invoice_history?: { enabled?: boolean }
  }
}

export interface PortalCheck {
  id: 'default-configuration' | 'cancel-at-period-end' | 'invoice-history'
  scenario: string
  ok: boolean
  detail: string
}

// ---------------------------------------------------------------------------
// Pure rule (unit-tested in stripe-portal-config.test.ts)
// ---------------------------------------------------------------------------

/** The three checks, in order. Without an active default configuration the other two cannot be judged. */
export function evaluatePortal(configurations: readonly PortalConfigurationShape[]): PortalCheck[] {
  const fallback = 'needs an active default configuration';
  const active = configurations.find(configuration => configuration.is_default && configuration.active);
  if (!active) {
    return [
      { id: 'default-configuration', scenario: 'both', ok: false, detail: `no active default configuration among ${configurations.length} (portal sessions are created without a configuration id)` },
      { id: 'cancel-at-period-end', scenario: 'Cancelar la suscripción', ok: false, detail: fallback },
      { id: 'invoice-history', scenario: 'Ver mi próximo cobro', ok: false, detail: fallback },
    ];
  }
  const cancel = active.features.subscription_cancel;
  const history = active.features.invoice_history;
  const cancelOk = cancel?.enabled === true && cancel.mode === 'at_period_end';
  return [
    { id: 'default-configuration', scenario: 'both', ok: true, detail: `default configuration ${active.id} is active` },
    {
      id: 'cancel-at-period-end',
      scenario: 'Cancelar la suscripción',
      ok: cancelOk,
      detail: cancelOk ? 'cancelling is enabled and ends at the end of the paid period' : `cancelling is ${cancel?.enabled === true ? 'enabled' : 'disabled'} and its mode is ${cancel?.mode ?? 'not set'}, expected enabled with at_period_end`,
    },
    {
      id: 'invoice-history',
      scenario: 'Ver mi próximo cobro',
      ok: history?.enabled === true,
      detail: history?.enabled === true ? 'invoice history is enabled' : 'invoice history is disabled or not set',
    },
  ];
}

/** `test` or `live`, from the key prefix. Never the key itself. */
export function keyMode(key: string): 'live' | 'test' {
  return key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : 'test';
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('stripe-portal-config: STRIPE_SECRET_KEY is not loaded (run it with `bunx varlock run -- bun scripts/qa/stripe-portal-config.ts`).');
    return 2;
  }
  const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  const configurations: PortalConfigurationShape[] = [];
  for await (const configuration of stripe.billingPortal.configurations.list({ limit: 100 })) {
    configurations.push(configuration);
  }
  const checks = evaluatePortal(configurations);

  console.log(pc.bold(`\nStripe Billing Portal (${keyMode(key)} mode): configuration check (a notice, never a failure)`));
  console.log('='.repeat(72));
  for (const check of checks) {
    console.log(`${check.ok ? pc.green('✔') : pc.yellow('!')} ${check.id}: ${check.detail}${check.scenario === 'both' ? '' : `  [${check.scenario}]`}`);
  }
  const failing = checks.filter(check => !check.ok).length;
  console.log(failing === 0
    ? `\n${pc.green('✔')} the portal is configured as the manual scenarios expect.`
    : `\n${pc.yellow('!')} ${failing} check(s) differ from what the scenarios describe. Fix the portal in the Stripe dashboard (Settings, Billing, Customer portal) or update the scenario.`);
  return process.argv.includes('--fail-on-drift') && failing > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await main());
}
