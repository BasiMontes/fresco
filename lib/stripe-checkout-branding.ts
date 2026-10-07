import type Stripe from 'stripe';

/**
 * FRESCO-845: how Stripe's hosted Checkout page looks, set on every session so it
 * works in test and live mode alike (the Dashboard's Branding settings are separate
 * per mode and would have to be repeated when Stripe goes live; per-session settings
 * override them).
 *
 * The colours are the `DESIGN.md` tokens `primary` and `background`: Stripe cannot
 * read CSS variables, so they are written out here and must follow that file. The
 * button text colour is picked by Stripe from the button colour. No font is set:
 * Stripe has no Figtree and its default is already a neutral sans.
 *
 * The icon is fetched by Stripe when the session is created, so it is a fixed
 * public production URL, not the request origin (a preview deploy behind Vercel's
 * protection would make that fetch fail and break the checkout).
 */
export const CHECKOUT_BRANDING = {
  display_name: 'Fresco',
  button_color: '#0F4E0E',
  background_color: '#FAF3E3',
  border_style: 'pill',
  icon: { type: 'url', url: 'https://fresco-pro.vercel.app/icons/icon-512.png' },
} satisfies Stripe.Checkout.SessionCreateParams.BrandingSettings;
