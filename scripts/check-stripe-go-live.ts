#!/usr/bin/env bun
/**
 * check-stripe-go-live.ts — FRESCO-1004 (audit 7b: A7-PAY-08, A7-LAUNCH-04)
 *
 * The read-only half of `docs/workflows/stripe-go-live.md`: reads what the Stripe account behind
 * `STRIPE_SECRET_KEY`, the Vercel production scope and the Supabase project hold, and exits 1 when
 * anything the first live day needs is missing. Nothing is written anywhere and no secret value is
 * ever read into the output: only names, ids and booleans are printed.
 *
 *   - the Billing Portal default configuration lets a customer cancel and change the card (without
 *     it nobody can cancel the first day);
 *   - the production endpoint is enabled and subscribed to every event the webhook handles, the
 *     dispute included (`lib/billing/handled-events.ts`, one list for both);
 *   - the Pro prices are fixed recurring euro prices with `tax_behavior` set, so "IVA incluido" is
 *     either true or deliberately absent;
 *   - the variable NAMES the production scope of Vercel and the Supabase Edge secrets need.
 *
 * Stripe keeps test and live apart: the mode of the key picks what is read, so run it once with
 * each key (the key never leaves the process: `bunx varlock run -- ...`). The Vercel and Supabase
 * checks do not depend on the mode.
 *
 * What Stripe does not expose through its API (the dunning rules) cannot be verified: it is listed
 * as MANUAL and blocks until the owner confirms it with `--ack dunning`.
 *
 * Usage:
 *   bunx varlock run -- bun scripts/check-stripe-go-live.ts
 *   bunx varlock run -- bun scripts/check-stripe-go-live.ts --ack dunning
 *
 * Exit codes: 0 every check passes (warnings allowed), 1 something is missing, 2 unusable setup.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import Stripe from 'stripe';
import { parse } from 'yaml';
import { HANDLED_EVENT_TYPES } from '../lib/billing/handled-events';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'manual';

export interface Check {
  id: string
  status: CheckStatus
  detail: string
}

export interface EndpointInfo {
  id: string
  url: string
  status: string
  enabled_events: string[]
}

export interface PortalConfigInfo {
  id: string
  active: boolean
  is_default: boolean
  features: {
    subscription_cancel?: { enabled?: boolean }
    payment_method_update?: { enabled?: boolean }
    invoice_history?: { enabled?: boolean }
  }
}

export interface PriceInfo {
  active: boolean
  currency: string
  unit_amount: number | null
  recurring: { interval: string, interval_count: number } | null
  tax_behavior: string | null
}

/** The production endpoint is enabled and subscribed to every event the webhook handles. */
export function auditWebhookEndpoint(endpoints: EndpointInfo[], productionHost: string, required: Iterable<string>): Check[] {
  const mine = endpoints.filter(endpoint => endpoint.status === 'enabled' && new URL(endpoint.url).host === productionHost);
  if (mine.length === 0) {
    return [{ id: 'webhook-endpoint', status: 'fail', detail: `no enabled endpoint points at ${productionHost}` }];
  }

  return mine.map((endpoint) => {
    const subscribed = new Set(endpoint.enabled_events);
    const missing = subscribed.has('*') ? [] : [...required].filter(event => !subscribed.has(event));
    return missing.length === 0
      ? { id: 'webhook-endpoint', status: 'pass' as const, detail: `${endpoint.id} is enabled and subscribed to every handled event` }
      : { id: 'webhook-endpoint', status: 'fail' as const, detail: `${endpoint.id} lacks ${missing.join(', ')}` };
  });
}

/** The default portal configuration is live and lets a customer cancel and change the card. */
export function auditPortal(configurations: PortalConfigInfo[]): Check[] {
  const config = configurations.find(candidate => candidate.is_default && candidate.active);
  if (!config) {
    return [{ id: 'portal-default', status: 'fail', detail: 'there is no active default Billing Portal configuration' }];
  }

  const checks: Check[] = [{ id: 'portal-default', status: 'pass', detail: `${config.id} is the active default` }];
  const need: [string, boolean | undefined][] = [
    ['subscription_cancel', config.features.subscription_cancel?.enabled],
    ['payment_method_update', config.features.payment_method_update?.enabled],
  ];
  for (const [feature, enabled] of need) {
    checks.push(enabled === true
      ? { id: `portal-${feature}`, status: 'pass', detail: `${feature} is enabled` }
      : { id: `portal-${feature}`, status: 'fail', detail: `${feature} is not enabled in the default configuration` });
  }
  if (config.features.invoice_history?.enabled !== true) {
    checks.push({ id: 'portal-invoice_history', status: 'warn', detail: 'invoice_history is off: customers cannot download their invoices from the portal' });
  }
  return checks;
}

/** A Pro price is a fixed recurring euro price with its tax behavior decided (`unspecified` is not a decision). */
export function auditPrice(label: string, priceId: string | undefined, price: PriceInfo | null, interval: 'month' | 'year', { required }: { required: boolean }): Check {
  const id = `price-${label}`;
  if (!priceId) {
    return required
      ? { id, status: 'fail', detail: `no price id is configured for the ${interval}ly plan` }
      : { id, status: 'warn', detail: `no price id is configured: the ${interval}ly plan stays hidden` };
  }
  if (!price) {
    return { id, status: 'fail', detail: `${priceId} could not be read from Stripe in this mode` };
  }

  const problems: string[] = [];
  if (!price.active) { problems.push('is not active'); }
  if (price.unit_amount === null || !price.recurring) { problems.push('is not a fixed recurring amount'); }
  else if (price.recurring.interval !== interval || price.recurring.interval_count !== 1) { problems.push(`is not billed every ${interval}`); }
  if (price.currency !== 'eur') { problems.push(`is in ${price.currency}, not eur`); }
  if (price.tax_behavior !== 'inclusive' && price.tax_behavior !== 'exclusive') {
    problems.push('has no tax_behavior (unspecified): decide inclusive or exclusive before it is used, Stripe lets it be set once');
  }

  return problems.length === 0
    ? { id, status: 'pass', detail: `${priceId} is active, tax ${price.tax_behavior}${price.tax_behavior === 'inclusive' ? ' (the app prints "IVA incluido")' : ''}` }
    : { id, status: 'fail', detail: `${priceId} ${problems.join('; ')}` };
}

/** Variable NAMES a scope must hold: every `required`, and one of each `anyOf` group. */
export function auditNames(scope: string, present: ReadonlySet<string>, { required, anyOf = [] }: { required: string[], anyOf?: string[][] }): Check[] {
  const checks: Check[] = [];
  const missing = required.filter(name => !present.has(name));
  checks.push(missing.length === 0
    ? { id: `${scope}-names`, status: 'pass', detail: `all ${required.length} required names are set` }
    : { id: `${scope}-names`, status: 'fail', detail: `missing ${missing.join(', ')}` });

  for (const group of anyOf) {
    checks.push(group.some(name => present.has(name))
      ? { id: `${scope}-names`, status: 'pass', detail: `one of ${group.join(' / ')} is set` }
      : { id: `${scope}-names`, status: 'fail', detail: `none of ${group.join(' / ')} is set` });
  }
  return checks;
}

/** The checks Stripe's API cannot answer: blocking until the owner acknowledges each one by id. */
export function manualChecks(acknowledged: ReadonlySet<string>): Check[] {
  const dunning = 'Stripe dashboard -> Settings -> Billing -> Subscriptions and emails -> Manage failed payments: Smart Retries on, and the final action is "cancel the subscription" (the webhook downgrades on `unpaid` and on `deleted`)';
  return [acknowledged.has('dunning')
    ? { id: 'dunning', status: 'pass', detail: 'acknowledged by the owner (--ack dunning)' }
    : { id: 'dunning', status: 'manual', detail: `not verifiable through the API. Confirm in the ${dunning}, then rerun with --ack dunning` }];
}

/** 0 when nothing fails and nothing manual is left unacknowledged, 1 otherwise. */
export function exitCode(checks: Check[]): number {
  return checks.some(check => check.status === 'fail' || check.status === 'manual') ? 1 : 0;
}

/** The names a CLI printed as JSON, ignoring any banner line before the first brace or bracket. */
export function parseJsonOutput(output: string): unknown {
  const start = output.search(/[{[]/);
  return start === -1 ? null : JSON.parse(output.slice(start));
}

const VERCEL_PRODUCTION = {
  required: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID_PRO_MONTH', 'CRON_SECRET'],
  anyOf: [['STRIPE_WEBHOOK_SECRET_PROD', 'STRIPE_WEBHOOK_SECRET'], ['RESEND_API_KEY', 'GMAIL_SMTP_APP_PASSWORD']],
};
const SUPABASE_SECRETS = { required: ['STRIPE_SECRET_KEY'] };

function run(command: string, args: string[]): string | null {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : null;
}

function vercelProductionNames(): Set<string> | null {
  const output = run('vercel', ['env', 'ls', 'production', '--format', 'json']);
  const parsed = output ? parseJsonOutput(output) as { envs?: { key: string }[] } | null : null;
  return parsed?.envs ? new Set(parsed.envs.map(env => env.key)) : null;
}

function supabaseSecretNames(projectRef: string): Set<string> | null {
  const output = run('supabase', ['secrets', 'list', '--project-ref', projectRef, '-o', 'json']);
  const parsed = output ? parseJsonOutput(output) as { name: string }[] | null : null;
  return Array.isArray(parsed) ? new Set(parsed.map(secret => secret.name)) : null;
}

async function readPrice(stripe: Stripe, priceId: string | undefined): Promise<PriceInfo | null> {
  if (!priceId) { return null; }
  try {
    const price = await stripe.prices.retrieve(priceId);
    return { active: price.active, currency: price.currency, unit_amount: price.unit_amount, recurring: price.recurring, tax_behavior: price.tax_behavior };
  }
  catch {
    return null;
  }
}

async function main(): Promise<number> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('check-stripe-go-live: STRIPE_SECRET_KEY is not set (run it with `bunx varlock run -- bun scripts/check-stripe-go-live.ts`).');
    return 2;
  }

  const acknowledged = new Set<string>();
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ack' && args[i + 1]) { acknowledged.add(args[++i]); }
  }

  const project = parse(readFileSync('.agents/project.yaml', 'utf8')) as { environments?: { production?: { web_url?: string, db_project_ref?: string } } };
  const production = project.environments?.production;
  if (!production?.web_url || !production.db_project_ref) {
    console.error('check-stripe-go-live: .agents/project.yaml -> environments.production needs web_url and db_project_ref.');
    return 2;
  }

  const stripe = new Stripe(key, { apiVersion: '2026-09-30.endive' });
  const checks: Check[] = [];

  const endpoints: EndpointInfo[] = [];
  for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) {
    endpoints.push({ id: endpoint.id, url: endpoint.url, status: endpoint.status, enabled_events: endpoint.enabled_events });
  }
  checks.push(...auditWebhookEndpoint(endpoints, new URL(production.web_url).host, HANDLED_EVENT_TYPES));

  const configurations: PortalConfigInfo[] = [];
  for await (const configuration of stripe.billingPortal.configurations.list({ limit: 100 })) {
    configurations.push({ id: configuration.id, active: configuration.active, is_default: configuration.is_default, features: configuration.features });
  }
  checks.push(...auditPortal(configurations));

  const monthId = process.env.STRIPE_PRICE_ID_PRO_MONTH;
  const yearId = process.env.STRIPE_PRICE_ID_PRO_ANUAL;
  checks.push(auditPrice('month', monthId, await readPrice(stripe, monthId), 'month', { required: true }));
  checks.push(auditPrice('year', yearId, await readPrice(stripe, yearId), 'year', { required: false }));

  const vercelNames = vercelProductionNames();
  checks.push(...(vercelNames
    ? auditNames('vercel-production', vercelNames, VERCEL_PRODUCTION)
    : [{ id: 'vercel-production-names', status: 'fail' as const, detail: 'could not read `vercel env ls production` (is the CLI installed, logged in and linked?)' }]));

  const supabaseNames = supabaseSecretNames(production.db_project_ref);
  checks.push(...(supabaseNames
    ? auditNames('supabase-secrets', supabaseNames, SUPABASE_SECRETS)
    : [{ id: 'supabase-secrets-names', status: 'fail' as const, detail: 'could not read `supabase secrets list` (is the CLI installed and logged in?)' }]));

  checks.push(...manualChecks(acknowledged));

  const mode = key.includes('_live_') ? 'live' : 'test';
  console.log(`Stripe go-live check, ${mode}-mode key. Read-only; only names and ids are printed.\n`);
  for (const check of checks) { console.log(`${check.status.toUpperCase().padEnd(6)} ${check.id.padEnd(30)} ${check.detail}`); }

  const code = exitCode(checks);
  console.log(code === 0
    ? `\nNothing is missing in ${mode} mode.${mode === 'test' ? ' Run it again with the live key before the flip.' : ''}`
    : '\nSomething is missing: see docs/workflows/stripe-go-live.md for how to fix each line.');
  return code;
}

if (import.meta.main) { process.exit(await main()); }
