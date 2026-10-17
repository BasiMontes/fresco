#!/usr/bin/env bun
/**
 * check-stripe-endpoints.ts — FRESCO-1001 (audit 7b: A7-PAY-03, ADR-0061)
 *
 * Lists the webhook endpoints of the Stripe account behind `STRIPE_SECRET_KEY` (read-only) and
 * compares each with the deploys this repo actually serves. Every environment shares one Stripe
 * account and one database, so each event is delivered to every enabled endpoint: an endpoint that
 * points at a frozen or unknown deploy is a second, stale writer of subscription state (the frozen
 * `fresco-dev` deploy kept writing with a handler older than the FRESCO-816 / 909 guards).
 *
 * A deploy counts as frozen when `vercel.json` -> `git.deploymentEnabled.<branch>` is `false`. The
 * environments and their hosts come from `.agents/project.yaml` -> `environments`, so nothing here
 * hardcodes a domain.
 *
 * This checks the HOST of each endpoint. That the deploy behind it runs the current SHA is the
 * other half of the go-live line (`docs/workflows/stripe-go-live.md`) and stays a manual
 * `vercel inspect` step.
 *
 * Stripe keeps test and live endpoints apart: the mode of the key picks which list this reads, so
 * run it once with each key (the key never leaves the process: `bunx varlock run -- ...`).
 *
 * Usage:
 *   bunx varlock run -- bun scripts/check-stripe-endpoints.ts      # exit 0 clean, 1 on a problem
 */

import { readFileSync } from 'node:fs';
import Stripe from 'stripe';
import { parse } from 'yaml';

export interface WebhookEndpoint {
  id: string
  url: string
  status: string
}

export interface DeployHost {
  environment: string
  host: string
  frozen: boolean
}

export interface EndpointProblem {
  endpointId: string
  url: string
  problem: string
}

/** Environment name -> the git branch Vercel deploys it from (`vercel.json` keys its switches by branch). */
const BRANCH_OF_ENVIRONMENT: Record<string, string> = { dev: 'dev', staging: 'staging', production: 'main' };

/** The hosts of the environments in `.agents/project.yaml`, each marked frozen or live from `vercel.json`. */
export function deployHosts(projectYaml: string, vercelJson: string): DeployHost[] {
  const environments = (parse(projectYaml) as { environments?: Record<string, { web_url?: string }> }).environments ?? {};
  const enabled = (JSON.parse(vercelJson) as { git?: { deploymentEnabled?: Record<string, boolean> } }).git?.deploymentEnabled ?? {};

  return Object.entries(environments)
    .filter(([name, env]) => name in BRANCH_OF_ENVIRONMENT && env.web_url)
    .map(([name, env]) => ({
      environment: name,
      host: new URL(env.web_url!).host,
      frozen: enabled[BRANCH_OF_ENVIRONMENT[name]] === false,
    }));
}

/** Problems with the ENABLED endpoints: one that points at a frozen deploy or at a host this repo does not serve. */
export function auditEndpoints(endpoints: WebhookEndpoint[], hosts: DeployHost[]): EndpointProblem[] {
  const problems: EndpointProblem[] = [];

  for (const endpoint of endpoints.filter(candidate => candidate.status === 'enabled')) {
    const host = new URL(endpoint.url).host;
    const deploy = hosts.find(candidate => candidate.host === host);

    if (!deploy) {
      problems.push({ endpointId: endpoint.id, url: endpoint.url, problem: 'points at a host that is not one of the environments of this repo' });
    }
    else if (deploy.frozen) {
      problems.push({ endpointId: endpoint.id, url: endpoint.url, problem: `points at the frozen ${deploy.environment} deploy (vercel.json disables its deployments), a stale writer of subscription state` });
    }
  }

  return problems;
}

async function main(): Promise<number> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('check-stripe-endpoints: STRIPE_SECRET_KEY is not set (run it with `bunx varlock run -- bun scripts/check-stripe-endpoints.ts`).');
    return 2;
  }

  const stripe = new Stripe(key, { apiVersion: '2026-09-30.endive' });
  const endpoints: WebhookEndpoint[] = [];
  for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) {
    endpoints.push({ id: endpoint.id, url: endpoint.url, status: endpoint.status });
  }

  const hosts = deployHosts(readFileSync('.agents/project.yaml', 'utf8'), readFileSync('vercel.json', 'utf8'));
  const problems = auditEndpoints(endpoints, hosts);
  const mode = key.includes('_live_') ? 'live' : 'test';

  console.log(`Stripe ${mode}-mode webhook endpoints: ${endpoints.length} (${endpoints.filter(endpoint => endpoint.status === 'enabled').length} enabled).`);
  for (const endpoint of endpoints) { console.log(`- ${endpoint.status.padEnd(8)} ${endpoint.url} (${endpoint.id})`); }

  if (problems.length === 0) {
    console.log('\nEvery enabled endpoint points at a live deploy of this repo.');
    return 0;
  }

  console.log('');
  for (const problem of problems) { console.log(`PROBLEM ${problem.endpointId} ${problem.url}: ${problem.problem}`); }
  console.log('\nDisable or delete the endpoint in the Stripe dashboard (Developers -> Webhooks), or point it at a live deploy.');
  return 1;
}

if (import.meta.main) { process.exit(await main()); }
