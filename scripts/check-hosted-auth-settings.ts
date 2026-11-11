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
 * FRESCO-1188 (integral review A3): it also checks what the confirmation and recovery emails depend on, which
 * lived in the hosted project too and could drift unseen: `mailer_autoconfirm` must be off, `site_url` and the
 * redirect allow-list must be what the app's links need, `rate_limit_email_sent` must be readable, and the three
 * live email templates must match `supabase/templates/*.html` (they are pushed by hand through the Management
 * API, so the repo copy can silently stop being the live one).
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

/** Settings that must be `false` on the hosted project (FRESCO-1188). */
export const EXPECTED_FALSE: readonly BooleanExpectation[] = [
  {
    key: 'mailer_autoconfirm',
    why: 'with it on, anyone signs up with any address and the confirmation email never proves ownership of it',
  },
];

/** The email templates pushed by hand to the hosted project, and the repo file each one must match (FRESCO-1188). */
export const TEMPLATE_TYPES = ['confirmation', 'recovery', 'email_change'] as const;
export type TemplateType = typeof TEMPLATE_TYPES[number];

/** What the live project must match, read from the repo. Optional: without it only the always-on checks run. */
export interface ExpectedAuthRelease {
  /** `site_url` must equal this (the production origin, no trailing slash). */
  siteUrl: string
  /** Every origin that sends users through `/auth/confirm` on this shared project (production, staging, dev). */
  origins: readonly string[]
  /** The repo copy of each template, by type. */
  templates: Partial<Record<TemplateType, string>>
}

/** The hosted minimum password length must be at least this (lib/validation/password-policy.ts). */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Compares a Management API `config/auth` response with what the app relies on. Pure: no
 * network, no env. Returns one human line per finding; empty means clean.
 */
export function evaluateAuthSettings(config: Record<string, unknown>, expected?: ExpectedAuthRelease): string[] {
  const findings: string[] = [];

  for (const { key, why } of EXPECTED_FALSE) {
    const value = config[key];
    if (value === false) { continue; }
    if (typeof value !== 'boolean') {
      findings.push(`${key}: not returned as a boolean (got ${JSON.stringify(value) ?? 'undefined'}), cannot be verified. Expected false: ${why}`);
      continue;
    }
    findings.push(`${key}: is true, expected false. ${why}`);
  }

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

  // FRESCO-1188: the rate limit of auth emails must at least be readable (it caps sign-ups and recoveries).
  const emailRate = config.rate_limit_email_sent;
  if (typeof emailRate !== 'number' || emailRate <= 0) {
    findings.push(`rate_limit_email_sent: not returned as a positive number (got ${JSON.stringify(emailRate) ?? 'undefined'}), cannot be verified`);
  }

  if (expected) {
    findings.push(...evaluateRedirectSettings(config, expected), ...evaluateTemplates(config, expected));
  }

  return findings;
}

/** A Supabase redirect pattern as a regex: `**` crosses slashes, `*` does not. */
function redirectPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\0/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/** `site_url` and the redirect allow-list: what the links the app and the templates build need. */
function evaluateRedirectSettings(config: Record<string, unknown>, expected: ExpectedAuthRelease): string[] {
  const findings: string[] = [];

  const siteUrl = config.site_url;
  if (typeof siteUrl !== 'string') {
    findings.push(`site_url: not returned as a string (got ${JSON.stringify(siteUrl) ?? 'undefined'}), cannot be verified. Expected ${expected.siteUrl}`);
  }
  else if (siteUrl.replace(/\/+$/, '') !== expected.siteUrl) {
    findings.push(`site_url: is ${siteUrl}, expected ${expected.siteUrl} (the recovery email builds its link from it)`);
  }

  const allowList = config.uri_allow_list;
  if (typeof allowList !== 'string') {
    findings.push(`uri_allow_list: not returned as a string (got ${JSON.stringify(allowList) ?? 'undefined'}), cannot be verified`);
    return findings;
  }
  const entries = allowList.split(',').map(entry => entry.trim()).filter(Boolean);
  if (entries.some(entry => entry === '*' || entry === '**')) {
    findings.push('uri_allow_list: contains a bare wildcard, so any address is an accepted redirect (an open redirect after confirmation)');
  }
  const patterns = entries.map(redirectPatternToRegExp);
  for (const origin of expected.origins) {
    const url = `${origin}/auth/confirm?next=/onboarding`;
    if (!patterns.some(pattern => pattern.test(url))) {
      findings.push(`uri_allow_list: does not cover ${url}, the link the sign-up confirmation sends people to from ${origin}`);
    }
  }
  return findings;
}

/** Strips what a round trip through the API may change without changing the email: line endings and trailing space. */
export function normalizeTemplate(content: string): string {
  return content.replace(/\r\n/g, '\n').split('\n').map(line => line.trimEnd()).join('\n').trim();
}

/** The live email templates against the repo copies. Content is never echoed: only the type and the first differing line. */
function evaluateTemplates(config: Record<string, unknown>, expected: ExpectedAuthRelease): string[] {
  const findings: string[] = [];
  for (const type of TEMPLATE_TYPES) {
    const repoCopy = expected.templates[type];
    const key = `mailer_templates_${type}_content`;
    if (repoCopy === undefined) {
      findings.push(`${key}: the repo copy supabase/templates/${type}.html could not be read, cannot be compared`);
      continue;
    }
    const live = config[key];
    if (typeof live !== 'string') {
      findings.push(`${key}: not returned as a string (got ${JSON.stringify(live) ?? 'undefined'}), cannot be verified against supabase/templates/${type}.html`);
      continue;
    }
    const liveLines = normalizeTemplate(live).split('\n');
    const repoLines = normalizeTemplate(repoCopy).split('\n');
    if (liveLines.join('\n') === repoLines.join('\n')) { continue; }
    const line = liveLines.findIndex((text, i) => text !== repoLines[i]);
    const at = line === -1 ? Math.min(liveLines.length, repoLines.length) + 1 : line + 1;
    findings.push(`${key}: the live ${type} email differs from supabase/templates/${type}.html (first difference at line ${at}; live has ${liveLines.length} lines, the repo copy ${repoLines.length}). Push the repo copy, or commit the live one`);
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

/**
 * What the live project must match: the production origin, every origin of this shared project, and the repo
 * copy of each email template. The origins come from `.agents/project.yaml` so there is one place that names them.
 */
export function readExpectedRelease(projectYaml: string, readTemplate: (type: TemplateType) => string | undefined): ExpectedAuthRelease {
  const parsed = parse(projectYaml) as { environments?: Record<string, { web_url?: unknown }> };
  const origin = (value: unknown) => (typeof value === 'string' ? value.replace(/\/+$/, '') : undefined);
  const siteUrl = origin(parsed.environments?.production?.web_url);
  if (!siteUrl) {
    throw new Error('environments.production.web_url is missing from .agents/project.yaml');
  }
  const origins = Object.entries(parsed.environments ?? {})
    .filter(([name]) => name !== 'local')
    .map(([, env]) => origin(env?.web_url))
    .filter((value): value is string => value !== undefined);
  const templates: Partial<Record<TemplateType, string>> = {};
  for (const type of TEMPLATE_TYPES) {
    const content = readTemplate(type);
    if (content !== undefined) { templates[type] = content; }
  }
  return { siteUrl, origins: [...new Set(origins)], templates };
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

  let expected: ExpectedAuthRelease;
  try {
    expected = readExpectedRelease(readFileSync('.agents/project.yaml', 'utf8'), (type) => {
      try { return readFileSync(`supabase/templates/${type}.html`, 'utf8'); }
      catch { return undefined; }
    });
  }
  catch (error) {
    console.error(`cannot resolve what the hosted project must match: ${(error as Error).message}`);
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

  const findings = evaluateAuthSettings(config, expected);
  if (findings.length === 0) {
    console.log(`hosted Auth settings: clean (${EXPECTED_TRUE.length + EXPECTED_FALSE.length + 6} settings and ${TEMPLATE_TYPES.length} email templates checked on project ${ref})`);
    return 0;
  }
  console.log(`hosted Auth settings: ${findings.length} finding(s) on project ${ref}`);
  for (const finding of findings) { console.log(`- ${finding}`); }
  return 1;
}

if (import.meta.main) {
  process.exit(await main());
}
