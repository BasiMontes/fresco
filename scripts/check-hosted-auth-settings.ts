#!/usr/bin/env bun
/**
 * check-hosted-auth-settings.ts — FRESCO-1090 (audit 8, A8-AUTHZ-04)
 *
 * Reads the Auth settings of the HOSTED production project (Management API, read only)
 * and fails when one the app relies on is off. Audits 7 and 8 could not grade the
 * password-change and guest-email rules above PLAUSIBLE because these toggles live in the
 * hosted project, not in the repo: `supabase/config.toml` has no key for
 * `require_current_password`, and the local file says nothing about what production does.
 *
 * Fails closed: a setting the API does not return, or returns as something other than a
 * boolean, is a finding. "I could not read it" is the failure this script exists to end, so
 * it can never count as a pass.
 *
 * Exit codes:
 *   0  every expected setting is as expected
 *   1  one or more settings differ (or are missing from the response)
 *   2  the settings could not be read at all (no token, HTTP error, bad JSON)
 *
 * Runs from `.github/workflows/hosted-auth-settings-check.yml` (weekly + on demand), not
 * from the per-PR pipeline: it needs a token for the production project (ADR-0017).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... bun scripts/check-hosted-auth-settings.ts
 *
 * Env:
 *   SUPABASE_ACCESS_TOKEN   personal access token (supabase.com/dashboard/account/tokens)
 */

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

interface BooleanExpectation {
  key: string
  why: string
}

/** Settings that must be `true` on the hosted project. */
export const EXPECTED_TRUE: readonly BooleanExpectation[] = [
  {
    key: 'security_update_password_require_current_password',
    why: 'GoTrue refuses a password change that does not carry the current password (A8-AUTHZ-04); the app check alone is bypassable by calling /auth/v1/user directly',
  },
  {
    key: 'security_update_password_require_reauthentication',
    why: 'a password change needs a recent login or a nonce (mirrors secure_password_change in supabase/config.toml)',
  },
  {
    key: 'mailer_secure_email_change_enabled',
    why: 'an email change is confirmed on both the old and the new address (mirrors double_confirm_changes in supabase/config.toml)',
  },
  {
    key: 'security_captcha_enabled',
    why: 'captcha on the Auth endpoints, which the guest sign-in and sign-up paths rely on',
  },
];

/** The hosted minimum password length must be at least this (lib/validation/password-policy.ts). */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Compares a Management API `config/auth` response with what the app relies on. Pure: no
 * network, no env. Returns one human line per finding; empty means clean.
 */
export function evaluateAuthSettings(config: Record<string, unknown>): string[] {
  const findings: string[] = [];

  for (const { key, why } of EXPECTED_TRUE) {
    const value = config[key];
    if (value === true) { continue; }
    if (typeof value !== 'boolean') {
      findings.push(`${key}: not returned as a boolean (got ${JSON.stringify(value) ?? 'undefined'}), cannot be verified. Expected true: ${why}`);
      continue;
    }
    findings.push(`${key}: is false, expected true. ${why}`);
  }

  const minLength = config.password_min_length;
  if (typeof minLength !== 'number') {
    findings.push(`password_min_length: not returned as a number (got ${JSON.stringify(minLength) ?? 'undefined'}), cannot be verified. Expected at least ${MIN_PASSWORD_LENGTH}`);
  }
  else if (minLength < MIN_PASSWORD_LENGTH) {
    findings.push(`password_min_length: is ${minLength}, expected at least ${MIN_PASSWORD_LENGTH} (lib/validation/password-policy.ts)`);
  }

  return findings;
}

/** The production project ref, read from `.agents/project.yaml` so there is one place that names it. */
export function readProductionProjectRef(projectYaml: string): string {
  const parsed = parse(projectYaml) as { environments?: { production?: { db_project_ref?: unknown } } };
  const ref = parsed.environments?.production?.db_project_ref;
  if (typeof ref !== 'string' || ref.length === 0) {
    throw new Error('environments.production.db_project_ref is missing from .agents/project.yaml');
  }
  return ref;
}

async function main(): Promise<number> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN is not set: cannot read the hosted Auth settings');
    return 2;
  }

  let ref: string;
  try {
    ref = readProductionProjectRef(readFileSync('.agents/project.yaml', 'utf8'));
  }
  catch (error) {
    console.error(`cannot resolve the production project: ${(error as Error).message}`);
    return 2;
  }

  let config: Record<string, unknown>;
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      // Status only: the body of an error response is not ours to echo into a CI log.
      console.error(`Management API answered HTTP ${res.status}: cannot read the hosted Auth settings`);
      return 2;
    }
    config = await res.json() as Record<string, unknown>;
  }
  catch (error) {
    console.error(`cannot read the hosted Auth settings: ${(error as Error).name}`);
    return 2;
  }

  const findings = evaluateAuthSettings(config);
  if (findings.length === 0) {
    console.log(`hosted Auth settings: clean (${EXPECTED_TRUE.length + 1} settings checked on project ${ref})`);
    return 0;
  }
  console.log(`hosted Auth settings: ${findings.length} finding(s) on project ${ref}`);
  for (const finding of findings) { console.log(`- ${finding}`); }
  return 1;
}

if (import.meta.main) {
  process.exit(await main());
}
