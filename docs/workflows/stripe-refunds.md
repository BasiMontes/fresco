# Stripe refunds: what they do to a subscription

How a refund made from the Stripe dashboard affects a Pro account, and the one step that is not code (FRESCO-900, decided with the founder on 2026-10-14).

## The rule

A **full refund of the charge of the current billing period cancels the subscription**, and the account goes back to Free.

| What you refund in Stripe | What happens |
|---|---|
| The whole charge of the current period | The subscription is cancelled at once, with no proration and no final invoice. Stripe then sends `customer.subscription.deleted` and the account becomes Free through the usual path. |
| Part of a charge (a goodwill gesture) | Nothing. The person stays Pro and is charged again next cycle as usual. |
| A charge from an earlier period | Nothing. |
| A charge whose subscription already ended | Nothing. |
| The proportional refund of an account deletion | Nothing. Deleting the account already cancelled the subscription (ADR-0043). |

Why cancel and not just lower the plan: with the subscription still active, the next `customer.subscription.updated` event or the reconciliation job (ADR-0015) would put the account back to Pro, and the next cycle would charge the person again. Cancelling removes both.

A cancellation made this way carries `cancellation_details.comment = "refund:<charge id>"`, so it can be told apart from a cancellation the person asked for.

## How it works in the code

- `POST /api/stripe/webhook` handles `charge.refunded` like every other handled event: claimed by `event.id`, completed once it succeeds, released if the handler throws (FRESCO-816, FRESCO-909).
- `resolveRefundCancellation` (`lib/billing/refund.ts`) decides. It cancels only if the refund is total, the subscription has not ended, and the charge is from the current period (`charge.created >= current_period_start`; `Charge` no longer carries `invoice`). If the period start cannot be read it does nothing: no proof, no cancellation.
- The handler never writes the profile itself. `plan` has one writer, the `customer.subscription.deleted` path (ADR-0007).

## Owner step: the webhook must listen to `charge.refunded`

Without it the event never arrives and refunding behaves as before, however correct the code is.

**State on 2026-10-14:** done for the three endpoints that exist, `fresco-dev`, `fresco-pre` and `fresco-pro`. All three are in Stripe **test mode**; there is no live-mode endpoint yet. When the live endpoint is created, give it `charge.refunded` along with the four events the route handles (`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`). Today none of the three listens to `checkout.session.async_payment_succeeded`, which the route does handle; it only matters with delayed payment methods.

To see what each endpoint listens to (read-only; uses the test key already in `.env`):

```bash
set -a; source .env; set +a
curl -sS -u "$STRIPE_SECRET_KEY:" "https://api.stripe.com/v1/webhook_endpoints?limit=30" \
  | jq -r '.data[] | "\(.url)  livemode=\(.livemode)  \(.enabled_events|join(", "))"'
```

To add the event to an endpoint, send the **whole** list, because the update replaces it: fetch the current `enabled_events`, append `charge.refunded` and `POST /v1/webhook_endpoints/<id>` with every `enabled_events[]`. Or do it in the dashboard: **Developers > Webhooks**, select the endpoint, add the event.

## How to check it, in test mode

1. Subscribe a test account to Pro.
2. In the Stripe dashboard refund the whole charge of that subscription.
3. The subscription turns `canceled` within seconds, its cancellation comment reads `refund:ch_...`, and the account shows Free.
4. Repeat with a partial refund of another test subscription: it must stay `active` and Pro.

## What to know before refunding

- The cancellation is immediate and cannot be undone. If a full refund was a mistake, the person has to subscribe again and pay again.
- To give money back and keep the person on Pro, refund only part of the charge.
- A refund the webhook did not act on (an ignored case) is logged with its reason: search the logs of `/api/stripe/webhook` for `left the subscription alone`.
