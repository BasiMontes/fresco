// FRESCO-779: shared vectors for the push-endpoint allowlist. The same lists are
// run through `isAllowedPushEndpoint` (unit test) and through the database
// CHECK `push_subscriptions_endpoint_allowed` (tests/db), so the two copies of
// the rule cannot drift.

export const ALLOWED_PUSH_ENDPOINTS: readonly string[] = [
  'https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bHun4MxP5egoKMwt2KZFBaFUH',
  'https://fcm.googleapis.com/wp/dQw4w9WgXcQ',
  'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk',
  'https://web.push.apple.com/QGxyz-abc_123',
  'https://api.push.apple.com/3/device/abc123',
  'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAAbc%2Fdef',
]

export const REJECTED_PUSH_ENDPOINTS: readonly string[] = [
  // Not https
  'http://fcm.googleapis.com/fcm/send/abc',
  // Arbitrary hosts, including cloud metadata and loopback targets
  'https://attacker.tld/x',
  'https://169.254.169.254/latest/meta-data/',
  'https://localhost/x',
  'https://127.0.0.1/x',
  // Allowed host used as a prefix, a userinfo, a port or a path decoy
  'https://fcm.googleapis.com.attacker.tld/x',
  'https://fcm.googleapis.com@attacker.tld/x',
  'https://fcm.googleapis.com:8443/fcm/send/abc',
  'https://attacker.tld/https://fcm.googleapis.com/fcm/send/abc',
  'https://evilpush.apple.com/x',
  'https://push.apple.com.attacker.tld/x',
  'https://notify.windows.com.attacker.tld/x',
  // Missing path separator, spaces, newlines
  'https://fcm.googleapis.com',
  'https://fcm.googleapis.com/fcm/send/a b',
  'https://fcm.googleapis.com/fcm/send/a\nb',
  // Case is not normalised by browsers' push services
  'https://FCM.googleapis.com/fcm/send/abc',
  // Other schemes and junk
  'ftp://fcm.googleapis.com/x',
  'javascript:alert(1)',
  '',
]
