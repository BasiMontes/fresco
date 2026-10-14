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

## Owner step: subscribe the webhook to `charge.refunded`

Without this the event never arrives and refunding behaves as before, however correct the code is.

1. In the Stripe Dashboard open **Developers > Webhooks** and select the endpoint of each environment (the URLs are in `docs/workflows/environments.md`).
2. Add `charge.refunded` to the events it listens to, next to the four it already has (`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`).
3. Do it in **test mode and in live mode**: they are separate endpoints.

## How to check it, in test mode

1. Subscribe a test account to Pro.
2. In the Stripe dashboard refund the whole charge of that subscription.
3. The subscription turns `canceled` within seconds, its cancellation comment reads `refund:ch_...`, and the account shows Free.
4. Repeat with a partial refund of another test subscription: it must stay `active` and Pro.

## What to know before refunding

- The cancellation is immediate and cannot be undone. If a full refund was a mistake, the person has to subscribe again and pay again.
- To give money back and keep the person on Pro, refund only part of the charge.
- A refund the webhook did not act on (an ignored case) is logged with its reason: search the logs of `/api/stripe/webhook` for `left the subscription alone`.
