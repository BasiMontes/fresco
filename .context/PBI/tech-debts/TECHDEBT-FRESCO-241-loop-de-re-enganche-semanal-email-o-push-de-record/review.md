# FRESCO-241 — PR1 Review (#119)

Independent adversarial review, `feat/FRESCO-241-vapid-push-subscriptions` -> `dev`.

## Findings

| Severity | Finding | Verdict | Action |
|---|---|---|---|
| MAJOR | Migration timestamp `20260823180000` collides with unmerged `feat/FRESCO-243` migration prefix, and doesn't match the version Supabase actually recorded on apply (`20260823180041`) | legitimate | Fixed: renamed file to `20260823180041_create_push_subscriptions_table.sql` (commit `c473c3a`) |
| MINOR | `last_used_at` has no write path yet (no UPDATE policy) | legitimate, deferred | Noted for PR3 (send logic needs service-role bump) |
| MINOR | `endpoint` unique-violation could act as a cross-user existence oracle | legitimate, deferred | Noted for PR2/3 (use `ON CONFLICT DO UPDATE` on insert, not raw constraint error) |
| NIT | `docs:` vs `chore:` prefix on the env-placeholder commit | dismissed | cosmetic, either is defensible |

Verified correct (no issue): FK chain `push_subscriptions.user_id -> user_profiles.id -> auth.users.id` (cascade delete), RLS shape mirrors `favorites` exactly (`(select auth.uid())`, select/insert/delete only, `to authenticated`), table GRANT present, `user_id` indexed, `endpoint` global-uniqueness is correct per Push API spec, `types.ts` diff additive and consistent, `.env.example` placeholder-only (no leaked secrets), commit hygiene clean (no AI attribution).

## Verdict

Approve-with-nits. MAJOR fixed before merge. MINOR items are forward notes for PR2/PR3, not blockers for PR1.

---

# FRESCO-241 — PR2 Review (#120)

Independent adversarial review, `feat/FRESCO-241-push-opt-in-ui` -> `dev`.

## Findings

| Severity | Finding | Verdict | Action |
|---|---|---|---|
| MAJOR | `unsubscribeFromPush` unsubscribed browser before deleting the DB row — a failure between the two steps orphaned the `push_subscriptions` row permanently (retry finds no browser subscription, short-circuits before ever reaching the delete) | legitimate | Fixed: reordered to DB-delete-first (commit `f21a7d3`) |
| MINOR | `public/sw.js` `notificationclick` tab-matching uses exact `pathname` string equality, no trailing-slash/query/hash tolerance | legitimate, deferred | Noted for PR3 once real payload URLs exist |
| NIT | unused optional `userId` param on `savePushSubscription`/`deletePushSubscription`, copied from `favorites.ts` convention | dismissed | never called with a value, no exploitable path |

Verified correct: `subscribeToPush` uses `subscription.toJSON().keys` (not naive property access), `23505` unique-violation swallowed as no-op, `user_id` always sourced from `auth.getUser()` never client-supplied, service worker `push`/`notificationclick` both wrap async work in `event.waitUntil(...)`, `isPushSupported()` actually gates the toggle (not decorative), data-testid coverage present, diff scoped exactly to the 9 described files.

## Verdict

Approve-with-nits after the MAJOR fix. MINOR deferred to PR3.
