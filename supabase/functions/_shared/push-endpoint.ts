// FRESCO-779 (audit-6 A6-S2): which Web Push endpoints this project will talk
// to. A push `endpoint` is a URL the browser got from its vendor's push
// service, and the weekly re-engagement function POSTs to it from Supabase's
// infrastructure with a signed VAPID header. A row with an arbitrary URL
// would turn that into a blind SSRF, so only the real push services are
// allowed.
//
// This is the TypeScript half of a rule that lives in the database as
// `push_subscriptions_endpoint_allowed` (migration
// 20261002085259_validate_push_subscription_endpoints.sql). The CHECK is the
// door; this copy is defence in depth for the sender, so a row that predates
// the constraint, or one written by something other than a client, is skipped
// instead of fetched. `tests/db/push-subscriptions-validation.test.ts` runs the
// same vectors (`push-endpoint.fixtures.ts`) through both and fails if they
// ever disagree.
//
// Hosts: Chrome / Edge / Opera / Samsung (FCM), Firefox (Mozilla autopush),
// Safari (`web.push.apple.com` and regional siblings), legacy Edge / WNS
// (`*.notify.windows.com`). The `/` straight after the host is deliberate: it
// rejects `fcm.googleapis.com.attacker.tld`, `fcm.googleapis.com@attacker.tld`
// and an explicit port.

export const MAX_PUSH_ENDPOINT_LENGTH = 2048

const PUSH_ENDPOINT_PATTERN = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)\/\S*$/

export function isAllowedPushEndpoint(endpoint: string): boolean {
  return endpoint.length <= MAX_PUSH_ENDPOINT_LENGTH && PUSH_ENDPOINT_PATTERN.test(endpoint)
}
