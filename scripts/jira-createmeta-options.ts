/**
 * FRESCO-928 — option lists of Jira select fields, read from `createmeta`.
 *
 * `scripts/sync-jira-fields.ts` reads a select field's options through
 * `GET /rest/api/3/field/{id}/context/{ctx}/option`. In a team-managed project
 * that endpoint answers 404 ("The custom field was not found"), so the catalog
 * got `options: {}` for every QA field and `bun run jira:check` reported six
 * mismatches that were really a gap in the catalog, not in Jira.
 *
 * `GET /rest/api/3/issue/createmeta/{project}/issuetypes[/{id}]` carries the
 * same lists as `allowedValues`, per issue type, and works for any project. A
 * field that is on no issue type's screen never appears there, which is the
 * truthful answer: it cannot be used in that project.
 */

export interface CreatemetaOption {
  id: string
  value: string
}

export interface CreatemetaField {
  fieldId: string
  allowedValues?: { id: string, value?: string }[]
}

/** Merge the `allowedValues` of every field across issue types: by field id, no repeated option, Jira's order. */
export function collectCreatemetaOptions(fieldsPerIssueType: CreatemetaField[][]): Map<string, CreatemetaOption[]> {
  const merged = new Map<string, CreatemetaOption[]>();
  for (const fields of fieldsPerIssueType) {
    for (const field of fields) {
      for (const option of field.allowedValues ?? []) {
        if (!option.value) {
          continue;
        }
        const list = merged.get(field.fieldId) ?? [];
        if (!list.some(known => known.id === option.id)) {
          list.push({ id: option.id, value: option.value });
        }
        merged.set(field.fieldId, list);
      }
    }
  }
  return merged;
}

interface FetchCreatemetaInput {
  baseUrl: string
  /** Full `Authorization` header value. */
  authorization: string
  projectKey: string
  fetchImpl?: typeof fetch
}

async function getJson<T>({ url, authorization, fetchImpl }: { url: string, authorization: string, fetchImpl: typeof fetch }): Promise<T | null> {
  const response = await fetchImpl(url, { headers: { Authorization: authorization, Accept: 'application/json' } });
  return response.ok ? (await response.json() as T) : null;
}

/**
 * Options of every select field on any issue type of the project. Best effort:
 * a project or an issue type Jira will not describe yields nothing for it,
 * never an exception, so the caller keeps its own warning for a declared field
 * that ends up with no options.
 */
export async function fetchCreatemetaOptions({ baseUrl, authorization, projectKey, fetchImpl = fetch }: FetchCreatemetaInput): Promise<Map<string, CreatemetaOption[]>> {
  const root = `${baseUrl}/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`;
  const types = await getJson<{ issueTypes?: { id: string }[] }>({ url: root, authorization, fetchImpl });

  const fieldsPerIssueType: CreatemetaField[][] = [];
  for (const issueType of types?.issueTypes ?? []) {
    const detail = await getJson<{ fields?: CreatemetaField[] }>({ url: `${root}/${issueType.id}`, authorization, fetchImpl });
    if (detail?.fields) {
      fieldsPerIssueType.push(detail.fields);
    }
  }
  return collectCreatemetaOptions(fieldsPerIssueType);
}

/** `project.project_key` from the text of `.agents/project.yaml`, or `null` when absent or unset. */
export function readProjectKey(yamlText: string): string | null {
  const match = yamlText.match(/^ {2}project_key:[ \t]*(\S.*)?$/m);
  const raw = match?.[1]?.replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '');
  return raw && raw !== 'null' ? raw : null;
}
