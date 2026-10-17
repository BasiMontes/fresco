# Stripe go-live: the mode guard and the webhook endpoints

What must be true, and in what order, when production starts charging with live Stripe keys (FRESCO-1001, ADR-0061). FRESCO-1004 owns the full go-live list; the lines below are the ones this guard adds to it.

## Why there is a guard

Every environment shares one Supabase project and one Stripe account. `fresco-pre` is public and runs test keys, so without a guard a test card there would make a production account Pro. The webhook, the grant and the checkout therefore compare the Stripe **mode** of what they handle with two things (`lib/billing/stripe-mode.ts`):

| Layer | Source of the mode | Refuses |
|---|---|---|
| The deploy | The prefix of its `STRIPE_SECRET_KEY` (`sk_live_` / `rk_live_` = live, `sk_test_` / `rk_test_` = test) | An event of the other mode: webhook answers 400, nothing is written |
| The database | `public.billing_mode.stripe_livemode`, one row, read by the service role only | Any event or checkout of the other mode, from any deploy |
| The profile | `user_profiles.stripe_livemode`, stored next to the Stripe ids | A subscription, cancellation or refund event of the other mode |

A deploy or database whose mode cannot be read makes the webhook answer 500 (Stripe retries) and the checkout answer 500. A deploy and a database of different modes make the checkout answer 503.

## Before the flip

- [ ] The migration that creates `billing_mode` is on the hosted database: `supabase migration list --linked` shows it applied. Without it the webhook answers 500.
- [ ] Every Stripe endpoint points at a deploy of the **current SHA**. For each environment that has an enabled endpoint, `vercel inspect https://<host>` and compare its creation time with the commit being released. A stale deploy is a second writer of subscription state (A7-PAY-03).
- [ ] The endpoints match the deploys this repo serves. Run it once per mode, with the test key and with the live key:

  ```bash
  bunx varlock run -- bun scripts/check-stripe-endpoints.ts
  ```

  It exits 1 when an enabled endpoint points at a frozen deploy (`vercel.json` -> `git.deploymentEnabled.<branch>` is `false`) or at a host this repo does not serve. Fix it in the Stripe dashboard (Developers -> Webhooks): disable or delete the endpoint, or point it at a live deploy. That step is the owner's; the script only reads.

- [ ] **The sender domain is verified before Stripe goes live** (FRESCO-1005, A7-LAUNCH-01). The subscription confirmation email is a legal obligation (TRLGDCU art. 98.7), and while `SEND_FROM` in `lib/email/resend.ts` is `onboarding@resend.dev` Resend delivers only to the account owner, so a real customer would be charged and never receive it. Before the flip, one of these holds, and one real delivery has been confirmed to an address that is not the owner's (a checkout in test mode with a second mailbox is enough):

  - **Provisional, no cost**: `GMAIL_SMTP_APP_PASSWORD` (a Gmail app password for `hola.frescoapp@gmail.com`, the account Supabase Auth already sends from) is set in the Production scope of Vercel. The confirmation then goes out through Gmail SMTP as `Fresco <hola.frescoapp@gmail.com>` (`lib/email/gmail-smtp.ts`). Gmail caps daily sends and the reputation is that of a personal account, so this is for a small volume.
  - **Final**: the domain is verified in Resend (FRESCO-886) and `SEND_FROM` in `lib/email/resend.ts` uses it. Then remove `lib/email/gmail-smtp.ts` and its branch.

  With neither, the email still goes through Resend's sandbox sender, which delivers only to the account owner. A rejected send is not silent any more: it goes to Sentry with the tag `email: subscription-confirmation` and leaves a row in `pending_confirmation_emails`, which `stripe-reconcile` retries for five days. After the domain works, the backlog clears on the next cron pass; check it is empty:

  ```bash
  supabase db query --linked "select subscription_id, attempts, last_error from public.pending_confirmation_emails order by created_at"
  ```

  Rows at five attempts were given up on and need a manual send or a decision.

## The flip

Order matters. Production must have the live keys and the database must say live in the same window; between the two steps the checkout answers 503 and the webhook refuses events, which is safe and recoverable (Stripe retries a refused event).

1. In the Stripe dashboard, in **live mode**, register the production endpoint and copy its signing secret.
2. In Vercel, set the production scope's live `STRIPE_SECRET_KEY`, live webhook secret and live price ids. Do not touch the Preview scope: `fresco-pre` and `fresco-dev` keep test keys.
3. Flip the database (the Management API runs it as `postgres`; no client role and not even the service role can write this table):

   ```bash
   supabase db query --linked "update public.billing_mode set stripe_livemode = true"
   ```

4. Redeploy production so it picks up the keys, then verify with a real checkout that the profile gets `stripe_livemode = true` next to its Stripe ids.

From this moment the events of `fresco-pre` and `fresco-dev` (test mode) are refused by every deploy, and `fresco-pre` answers 503 on checkout.

## After the flip

- Profiles that hold **test** Stripe ids keep `stripe_livemode = false`. The checkout does not reuse a customer of the other mode, so a person who tried Pro in test mode starts a clean live customer (with no free trial, since the ids mark it as used). The production reconcile cron downgrades their old test subscription when the live key cannot find it.
- The `@requiere-stripe-real` e2e scenarios against `fresco-pre` can no longer grant Pro while the database is live. To run them, set the database back to test mode for the window and restore it afterwards, or keep them out of the live period.

## Rolling back

```bash
supabase db query --linked "update public.billing_mode set stripe_livemode = false"
```

together with the test keys on the production scope. Charges already made in live mode stay in Stripe; their profiles keep `stripe_livemode = true` and their events are refused until the database is live again.
