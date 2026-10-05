#!/usr/bin/env bun
/**
 * check-closure-evidence.ts — FRESCO-812 (audit-6 A6-P8): measure the Definition-of-Done
 * evidence rule from Jira instead of trusting that it was followed.
 *
 *   bun run jira:closure-evidence            # tickets resolved in the last 7 days
 *   bun run jira:closure-evidence --days 14
 *
 * A ticket that reached a done status with ZERO comments has no verification note, which
 * is the pattern audit-6 found in 25% of recent closures. The check lists them and exits
 * 1 when there is any, 0 when there are none. A comment is the proxy: whether it really
 * proves the work is still a review call (`.context/backlog/definition-of-done.md`).
 *
 * `acli` cannot return comments from a search, so this reads the REST search endpoint
 * (`comment.total`) with the same credentials as the other jira scripts. The host comes
 * from `.agents/project.yaml` through `cli/lib/atlassian-instance.ts`, never from the env.
 */

import { readFileSync } from 'node:fs';
import { resolveAtlassianInstance } from '../cli/lib/atlassian-instance';

export interface ClosedIssue {
  key: string
  summary: string
  issueType: string
  commentCount: number
}

interface SearchIssue {
  key: string
  fields: { summary?: string, issuetype?: { name?: string }, comment?: { total?: number } }
}

interface SearchPage {
  issues: SearchIssue[]
  nextPageToken?: string
}

const DEFAULT_DAYS = 7;

/** The closed tickets that carry no comment at all: the ones with no verification note. */
export function findClosedWithoutEvidence(issues: ClosedIssue[]): ClosedIssue[] {
  return issues.filter(issue => issue.commentCount === 0);
}

export function parseDays(argv: string[]): number {
  const index = argv.indexOf('--days');
  if (index === -1) {
    return DEFAULT_DAYS;
  }
  const days = Number(argv[index + 1]);
  if (!Number.isInteger(days) || days < 1) {
    throw new Error('--days needs a positive whole number.');
  }
  return days;
}

function readProjectKey(): string {
  const yaml = readFileSync('.agents/project.yaml', 'utf8');
  const match = yaml.match(/^\s*project_key:\s*['"]?([A-Z][A-Z0-9]+)['"]?/m);
  if (!match?.[1]) {
    throw new Error('project_key not found in .agents/project.yaml');
  }
  return match[1];
}

async function fetchResolved(baseUrl: string, auth: string, jql: string): Promise<ClosedIssue[]> {
  const issues: ClosedIssue[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ jql, fields: 'summary,issuetype,comment', maxResults: '100' });
    if (pageToken) {
      params.set('nextPageToken', pageToken);
    }
    const res = await fetch(`${baseUrl}/rest/api/3/search/jql?${params}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Jira search failed: HTTP ${res.status}`);
    }
    const page = await res.json() as SearchPage;
    for (const issue of page.issues) {
      issues.push({
        key: issue.key,
        summary: issue.fields.summary ?? '',
        issueType: issue.fields.issuetype?.name ?? '?',
        commentCount: issue.fields.comment?.total ?? 0,
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return issues;
}

async function main(): Promise<number> {
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  if (!email || !token) {
    console.error('ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN must be set (see .env.example).');
    return 1;
  }

  const days = parseDays(process.argv.slice(2));
  const { baseUrl } = resolveAtlassianInstance();
  const jql = `project = ${readProjectKey()} AND resolved >= -${days}d ORDER BY key ASC`;
  const closed = await fetchResolved(baseUrl, Buffer.from(`${email}:${token}`).toString('base64'), jql);
  const missing = findClosedWithoutEvidence(closed);

  console.log(`Closed in the last ${days} days: ${closed.length}. Without any comment: ${missing.length}.`);
  for (const issue of missing) {
    console.log(`  ${issue.key}  ${issue.issueType}  ${issue.summary.slice(0, 80)}`);
  }
  return missing.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(await main());
}
