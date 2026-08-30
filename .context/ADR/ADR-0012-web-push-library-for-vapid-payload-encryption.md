# ADR-0012 — `web-push` npm library for VAPID signing + payload encryption

- **Status:** Accepted
- **Date:** 2026-08-23
- **Deciders:** Basi Montes
- **Tags:** web-push, cryptography, edge-functions, dependency
- **Supersedes:** —
- **Superseded by:** —

---

## Context

FRESCO-241 (PR3)'s Edge Function needs to send an actual Web Push message: sign a VAPID JWT with the project's private key, and encrypt the notification payload per the Web Push protocol (`aes128gcm`, RFC 8291) using each subscription's `p256dh`/`auth` keys before POSTing to the browser's push service (FCM/Mozilla/etc. endpoint). This is real, easy-to-get-subtly-wrong cryptography — wrong padding, wrong key derivation, or a wrong header format fails silently (the push service just 4xxs) rather than raising an obvious error.

Two paths exist: hand-roll the VAPID JWT signing + `aes128gcm` encryption using Deno's native Web Crypto API, or depend on the `web-push` npm package (the de facto standard implementation, used by the vast majority of production Web Push senders) via Deno's `npm:` specifier support (confirmed available in Supabase Edge Functions, which run on Deno).

## Decision

We will use the `web-push` npm package (imported via `npm:web-push` in the Edge Function) for VAPID JWT signing and payload encryption, rather than a hand-rolled Web Crypto implementation. The Edge Function calls `webpush.sendNotification(subscription, payload, options)` per active `push_subscriptions` row, with VAPID details (`VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) supplied from Edge Function secrets (not the general `.env`, which is not available inside the Edge Function runtime).

## Consequences

- **Positive:** correctness of the crypto is delegated to a widely-used, actively-maintained library rather than this project's own implementation — eliminates an entire class of silent encryption bugs; matches the reasoning already applied project-wide (e.g. Stripe SDK, Resend SDK, Supabase SDK — this project consistently prefers vetted libraries over hand-rolled protocol implementations for anything security- or payment-adjacent).
- **Negative / trade-offs:** adds a dependency whose `npm:` compatibility inside Deno Edge Functions must be verified per-deploy (Deno's npm compat layer has occasional edge cases with packages that assume Node's `crypto`/`Buffer` globals); slightly larger cold-start bundle than a hand-rolled crypto-only implementation. If `npm:web-push` proves incompatible at deploy time, this ADR should be revisited (superseded) with the Web Crypto alternative.
- **Neutral / follow-ups:** the Edge Function must handle `web-push`'s error responses per subscription (410 Gone / 404 → delete the stale `push_subscriptions` row; other 4xx/5xx → log and skip, don't fail the whole batch for one bad subscription).

## Alternatives considered

- **Hand-rolled VAPID JWT + `aes128gcm` via Deno's native Web Crypto API** — rejected as the default: technically avoids one dependency, but reimplements RFC 8291 payload encryption and RFC 8292 VAPID signing from scratch, which is exactly the kind of protocol-level cryptography this project avoids hand-rolling elsewhere. Revisit only if `npm:web-push` turns out incompatible with the Edge Function runtime.

## References

- FRESCO-241 Stage 1 implementation plan (Jira comment, `spec_implementation_plan` fallback) — flagged this as a Stage-2 spike decision.
- `web-push` npm package: https://github.com/web-push-libs/web-push
- RFC 8291 (Message Encryption for Web Push), RFC 8292 (VAPID).
