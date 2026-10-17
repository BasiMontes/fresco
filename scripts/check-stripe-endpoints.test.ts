import { describe, expect, test } from 'bun:test';
import { auditEndpoints, deployHosts } from './check-stripe-endpoints';

/** FRESCO-1001 (audit 7b: A7-PAY-03) — a Stripe endpoint must not point at a frozen or unknown deploy. */

const PROJECT_YAML = `
environments:
  local:
    web_url: 'http://localhost:3000'
  dev:
    web_url: 'https://fresco-dev.example.app'
  staging:
    web_url: 'https://fresco-pre.example.app'
  production:
    web_url: 'https://fresco-pro.example.app'
`;
const VERCEL_JSON = JSON.stringify({ git: { deploymentEnabled: { dev: false } } });

const endpoint = (url: string, status = 'enabled') => ({ id: `we_${url.length}`, url, status });

describe('deployHosts', () => {
  test('reads the hosts from project.yaml and marks a branch whose deployments vercel.json disables as frozen', () => {
    expect(deployHosts(PROJECT_YAML, VERCEL_JSON)).toEqual([
      { environment: 'dev', host: 'fresco-dev.example.app', frozen: true },
      { environment: 'staging', host: 'fresco-pre.example.app', frozen: false },
      { environment: 'production', host: 'fresco-pro.example.app', frozen: false },
    ]);
  });

  test('no vercel.json switches means nothing is frozen', () => {
    expect(deployHosts(PROJECT_YAML, '{}').every(host => !host.frozen)).toBe(true);
  });
});

describe('auditEndpoints', () => {
  const hosts = deployHosts(PROJECT_YAML, VERCEL_JSON);

  test('enabled endpoints on the live deploys are clean', () => {
    expect(auditEndpoints([
      endpoint('https://fresco-pre.example.app/api/stripe/webhook'),
      endpoint('https://fresco-pro.example.app/api/stripe/webhook'),
    ], hosts)).toEqual([]);
  });

  test('an enabled endpoint on the frozen dev deploy is a problem (A7-PAY-03)', () => {
    const problems = auditEndpoints([endpoint('https://fresco-dev.example.app/api/stripe/webhook')], hosts);

    expect(problems).toHaveLength(1);
    expect(problems[0].problem).toContain('frozen dev deploy');
  });

  test('a DISABLED endpoint on the frozen deploy is fine: that is the fix', () => {
    expect(auditEndpoints([endpoint('https://fresco-dev.example.app/api/stripe/webhook', 'disabled')], hosts)).toEqual([]);
  });

  test('an enabled endpoint on a host this repo does not serve is a problem', () => {
    const problems = auditEndpoints([endpoint('https://old-preview-abc123.example.app/api/stripe/webhook')], hosts);

    expect(problems).toHaveLength(1);
    expect(problems[0].problem).toContain('not one of the environments');
  });
});
