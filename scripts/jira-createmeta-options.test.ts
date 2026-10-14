import { describe, expect, test } from 'bun:test';
import { collectCreatemetaOptions, fetchCreatemetaOptions, readProjectKey } from './jira-createmeta-options';

/**
 * FRESCO-928 — the option lists of a select field cannot be read through
 * `GET /field/{id}/context/...` in a team-managed project (it answers 404, so
 * the catalog got `options: {}` for every QA field). `createmeta` carries the
 * same lists as `allowedValues`, per issue type, for any project.
 */

describe('collectCreatemetaOptions', () => {
  test('keeps the options of each field, keyed by field id, in the order Jira returned them', () => {
    const options = collectCreatemetaOptions([
      [
        { fieldId: 'customfield_10194', allowedValues: [{ id: '1', value: 'critica' }, { id: '2', value: 'mayor' }] },
        { fieldId: 'summary' },
      ],
    ]);

    expect(options.get('customfield_10194')).toEqual([{ id: '1', value: 'critica' }, { id: '2', value: 'mayor' }]);
    expect(options.has('summary')).toBe(false);
  });

  test('merges the same field across issue types without repeating an option', () => {
    const options = collectCreatemetaOptions([
      [{ fieldId: 'customfield_10193', allowedValues: [{ id: '1', value: 'crash' }, { id: '2', value: 'data' }] }],
      [{ fieldId: 'customfield_10193', allowedValues: [{ id: '2', value: 'data' }, { id: '3', value: 'visual' }] }],
    ]);

    expect(options.get('customfield_10193')?.map(o => o.value)).toEqual(['crash', 'data', 'visual']);
  });

  test('skips an option with no label and a field with an empty list', () => {
    const options = collectCreatemetaOptions([
      [
        { fieldId: 'customfield_10193', allowedValues: [{ id: '1' }, { id: '2', value: 'crash' }] },
        { fieldId: 'customfield_10999', allowedValues: [] },
      ],
    ]);

    expect(options.get('customfield_10193')).toEqual([{ id: '2', value: 'crash' }]);
    expect(options.has('customfield_10999')).toBe(false);
  });
});

describe('fetchCreatemetaOptions', () => {
  function fakeFetch(routes: Record<string, unknown>): typeof fetch {
    return (async (url: string) => {
      const path = new URL(url).pathname;
      const body = routes[path];
      return body === undefined
        ? new Response('not found', { status: 404 })
        : new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
  }

  const base = { baseUrl: 'https://example.atlassian.net', authorization: 'Basic x', projectKey: 'FRESCO' };

  test('reads the issue types of the project and the fields of each one', async () => {
    const options = await fetchCreatemetaOptions({
      ...base,
      fetchImpl: fakeFetch({
        '/rest/api/3/issue/createmeta/FRESCO/issuetypes': { issueTypes: [{ id: '10011' }, { id: '10008' }] },
        '/rest/api/3/issue/createmeta/FRESCO/issuetypes/10011': {
          fields: [{ fieldId: 'customfield_10194', allowedValues: [{ id: '1', value: 'critica' }] }],
        },
        '/rest/api/3/issue/createmeta/FRESCO/issuetypes/10008': { fields: [{ fieldId: 'summary' }] },
      }),
    });

    expect(options.get('customfield_10194')).toEqual([{ id: '1', value: 'critica' }]);
  });

  test('an issue type that cannot be read is skipped, not fatal', async () => {
    const options = await fetchCreatemetaOptions({
      ...base,
      fetchImpl: fakeFetch({
        '/rest/api/3/issue/createmeta/FRESCO/issuetypes': { issueTypes: [{ id: '1' }, { id: '2' }] },
        '/rest/api/3/issue/createmeta/FRESCO/issuetypes/2': {
          fields: [{ fieldId: 'customfield_10194', allowedValues: [{ id: '1', value: 'critica' }] }],
        },
      }),
    });

    expect(options.get('customfield_10194')).toHaveLength(1);
  });

  test('an unreadable project gives an empty result instead of throwing', async () => {
    const options = await fetchCreatemetaOptions({ ...base, fetchImpl: fakeFetch({}) });

    expect(options.size).toBe(0);
  });

  test('sends the authorization header it was given', async () => {
    let seen: string | null = null;
    const spy = (async (_url: string, init?: RequestInit) => {
      seen = new Headers(init?.headers).get('authorization');
      return new Response(JSON.stringify({ issueTypes: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await fetchCreatemetaOptions({ ...base, fetchImpl: spy });

    expect(seen).toBe('Basic x');
  });
});

describe('readProjectKey', () => {
  test('reads project.project_key from the yaml text', () => {
    expect(readProjectKey('project:\n  project_name: Fresco\n  project_key: FRESCO\n')).toBe('FRESCO');
  });

  test('is null when the key is absent or unset', () => {
    expect(readProjectKey('project:\n  project_name: Fresco\n')).toBeNull();
    expect(readProjectKey('project:\n  project_key: null\n')).toBeNull();
    expect(readProjectKey('project:\n  project_key:\n')).toBeNull();
  });

  test('strips quotes and a trailing comment', () => {
    expect(readProjectKey('project:\n  project_key: "FRESCO" # the key\n')).toBe('FRESCO');
  });
});
