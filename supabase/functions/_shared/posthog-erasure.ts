// FRESCO-910 (audit C-06, GDPR art. 17): delete a person, and the events attached to it,
// from PostHog when their account is erased. Direct HTTP against PostHog's private API,
// like `posthog.ts` does for capture (no SDK: the Node one does not target Deno).
//
// Needs three Function secrets, none of them the public write key `posthog.ts` uses:
//   POSTHOG_PERSONAL_API_KEY  a personal API key allowed to write persons
//   POSTHOG_PROJECT_ID        the numeric project id
//   POSTHOG_API_HOST          the PRIVATE API host, e.g. https://eu.posthog.com
//                             (not the ingestion host, e.g. eu.i.posthog.com)
// Without them the function reports `not_configured` and the caller records it; account
// deletion itself is never held back by a missing analytics credential.
//
// Unlike the capture helper this one THROWS on a failed call: a failure to erase is the
// thing the caller must record so the deletion can be retried. The person is found by
// distinct id; the app identifies people in PostHog by their user id.

export type PostHogErasure = 'deleted' | 'not_found' | 'not_configured'

/** Per request: an analytics outage must not stall the account deletion for long. */
const REQUEST_TIMEOUT_MS = 8000

interface PostHogConfig {
  apiHost: string
  projectId: string
  personalApiKey: string
}

function readConfig(): PostHogConfig | null {
  const apiHost = Deno.env.get('POSTHOG_API_HOST')
  const projectId = Deno.env.get('POSTHOG_PROJECT_ID')
  const personalApiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY')
  if (!apiHost || !projectId || !personalApiKey) return null
  return { apiHost: apiHost.replace(/\/+$/, ''), projectId, personalApiKey }
}

export async function deletePostHogPerson(distinctId: string): Promise<PostHogErasure> {
  const config = readConfig()
  if (!config) return 'not_configured'

  const headers = { Authorization: `Bearer ${config.personalApiKey}` }
  const base = `${config.apiHost}/api/projects/${encodeURIComponent(config.projectId)}/persons`

  const lookup = await fetch(`${base}/?distinct_id=${encodeURIComponent(distinctId)}`, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!lookup.ok) throw new Error(`PostHog person lookup failed with status ${lookup.status}`)

  const { results } = await lookup.json() as { results?: Array<{ id: string | number }> }
  const person = results?.[0]
  if (!person) return 'not_found'

  const removal = await fetch(`${base}/${encodeURIComponent(String(person.id))}/?delete_events=true`, {
    method: 'DELETE',
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (removal.status === 404) return 'not_found'
  if (!removal.ok) throw new Error(`PostHog person deletion failed with status ${removal.status}`)
  return 'deleted'
}
