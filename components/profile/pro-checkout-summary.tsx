'use client';

import type { ProPriceInfo } from '@/lib/legal/pro-summary';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CONTACT_EMAIL, LEGAL_ENTITY } from '@/components/legal/legal-content-data';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { CONSENT_TEXTS } from '@/lib/legal/consent';
import { annualSavings, describeProPrice, formatProAmount } from '@/lib/legal/pro-summary';

export interface ProCheckoutSummaryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when the user confirms with the withdrawal waiver ticked, with the billing period they picked. The parent records the waiver and starts the checkout. */
  onConfirm: (interval: ProInterval) => void
  isSubmitting: boolean
  error: string | null
}

type PriceState = { status: 'loading' } | { status: 'error' } | { status: 'ready', info: ProPriceInfo };

export type ProInterval = 'month' | 'year';

const INTERVAL_OPTIONS = [
  { value: 'month', label: 'Mensual' },
  { value: 'year', label: 'Anual' },
];

async function fetchProPrice(interval: ProInterval): Promise<ProPriceInfo> {
  const res = await fetch(interval === 'year' ? '/api/stripe/pro-price?interval=year' : '/api/stripe/pro-price');
  if (!res.ok) {
    throw new Error(`pro-price ${interval} ${res.status}`);
  }
  return await res.json() as ProPriceInfo;
}

/**
 * FRESCO-794 (ADR-0040; lawyer draft clauses 6, 7 and 8, brief §5 item 9) — what
 * a user must be told before they are bound by the Pro subscription, in the
 * screen where they confirm it: what it includes, the price, the free trial (or
 * that it is already used), the automatic monthly renewal, the right to withdraw,
 * who the provider is. The price and trial come from Stripe through
 * `GET /api/stripe/pro-price`, never from a literal here.
 *
 * The one required checkbox is the request for immediate execution and the
 * acknowledgement that the withdrawal right is lost once the service is fully
 * performed (art. 103.m TRLGDCU). Not pre-ticked; "Continuar al pago" stays
 * disabled until it is ticked and the price has loaded.
 *
 * FRESCO-844: when the annual price is configured (the `?interval=year` request
 * answers), a Mensual/Anual selector appears and the price, savings and renewal
 * lines follow it. No annual price, no selector: the dialog is the monthly one.
 *
 * The wording is PROVISIONAL (lawyer draft, not validated), and the scope of the
 * waiver for a monthly subscription is an open decision in that draft (7.4); the
 * annual renewal and withdrawal wording is part of that same pending review.
 */
export function ProCheckoutSummary({ open, onOpenChange, onConfirm, isSubmitting, error }: ProCheckoutSummaryProps) {
  const [price, setPrice] = useState<PriceState>({ status: 'loading' });
  const [annual, setAnnual] = useState<ProPriceInfo | null>(null);
  const [interval, setInterval] = useState<ProInterval>('month');
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  // Each time the dialog opens: ask Stripe's price again and start with the box unticked.
  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setWaiverAccepted(false);
    setPrice({ status: 'loading' });
    setAnnual(null);
    setInterval('month');
    // Both prices are requested together and shown together (FRESCO-851): with the
    // annual price landing after the monthly one, the interval selector popped in
    // late and pushed the dialog's content down. The annual price is optional: if
    // it cannot be read there is simply no selector.
    void (async () => {
      const [monthly, yearly] = await Promise.allSettled([fetchProPrice('month'), fetchProPrice('year')]);
      if (cancelled) {
        return;
      }
      setAnnual(yearly.status === 'fulfilled' ? yearly.value : null);
      if (monthly.status === 'fulfilled') {
        setPrice({ status: 'ready', info: monthly.value });
      }
      else {
        console.error('[ProCheckoutSummary] could not load the price', monthly.reason);
        setPrice({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const canConfirm = price.status === 'ready' && waiverAccepted && !isSubmitting;
  const selected = interval === 'year' && annual ? annual : price.status === 'ready' ? price.info : null;
  const savings = price.status === 'ready' && annual && interval === 'year' ? annualSavings(price.info, annual) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} aria-label="Resumen de tu suscripción a Fresco Pro" data-testid="pro_checkout_dialog">
      <h2 className="text-h4">Antes de continuar</h2>
      <p className="mt-1 text-body-sm text-tertiary">Resumen de tu suscripción a Fresco Pro.</p>

      {price.status === 'ready' && annual && (
        <SegmentedControl
          aria-label="Plan de facturación"
          className="mt-4"
          options={INTERVAL_OPTIONS}
          value={interval}
          onChange={value => setInterval(value === 'year' ? 'year' : 'month')}
        />
      )}

      <ul className="mt-4 flex flex-col gap-3 text-body-sm text-tertiary">
        <li>
          <strong className="text-text">Qué incluye.</strong>
          {' '}
          Todo lo del plan Free y la personalización por aprendizaje: evita repetir recetas descartadas, prioriza las cocinadas y ajusta cantidades.
        </li>
        <li data-testid="pro_checkout_price">
          <strong className="text-text">Precio.</strong>
          {' '}
          {selected && describeProPrice(selected)}
          {savings !== null && ` Ahorras ${formatProAmount(savings, annual?.currency ?? 'eur')} al año frente a pagar 12 meses.`}
          {price.status === 'loading' && 'Cargando…'}
          {price.status === 'error' && 'No se pudo cargar el precio. Cierra y vuelve a abrir este resumen.'}
        </li>
        {price.status === 'ready' && (
          <li data-testid="pro_checkout_trial">
            <strong className="text-text">Prueba.</strong>
            {' '}
            {price.info.trialDays === null
              ? 'Ya usaste tu prueba gratuita: el primer cobro se realiza al contratar.'
              : `${price.info.trialDays} días de prueba gratis, sin tarjeta. Si no facilitas un medio de pago durante la prueba, la suscripción no se activa y vuelves al plan Free sin ningún cargo.`}
          </li>
        )}
        <li>
          <strong className="text-text">Renovación.</strong>
          {' '}
          Se renueva automáticamente cada
          {' '}
          {interval === 'year' ? 'año' : 'mes'}
          {' '}
          hasta que la canceles. Puedes cancelarla cuando quieras desde tu perfil, en «Gestionar mi suscripción».
        </li>
        <li>
          <strong className="text-text">Desistimiento.</strong>
          {' '}
          Tienes derecho a desistir del contrato en 14 días naturales, sin dar explicaciones. Detalles en los
          {' '}
          <Link href="/legal/terminos" target="_blank" className="text-primary underline" data-testid="pro_checkout_terms_link">Términos de Servicio</Link>
          .
        </li>
        <li data-testid="pro_checkout_provider">
          <strong className="text-text">Prestador.</strong>
          {' '}
          {LEGAL_ENTITY}
          . Contacto:
          {' '}
          {CONTACT_EMAIL}
          .
        </li>
      </ul>

      <label className="mt-4 flex cursor-pointer items-start gap-2 text-body-sm text-tertiary">
        <span className="flex size-6 shrink-0 items-center justify-center">
          {/* FRESCO-451: a single agree toggle, so the square variant. */}
          <Checkbox
            data-testid="pro_checkout_withdrawal_checkbox"
            checked={waiverAccepted}
            disabled={isSubmitting}
            onChange={e => setWaiverAccepted(e.target.checked)}
            className="rounded-sm"
          />
        </span>
        <span>{CONSENT_TEXTS.withdrawal_waiver}</span>
      </label>

      {error && (
        <p data-testid="upgrade_to_pro_error_message" role="alert" aria-live="assertive" className="mt-3 text-body-sm text-error">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" data-testid="pro_checkout_cancel_button" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="button" variant="action" data-testid="pro_checkout_confirm_button" disabled={!canConfirm} onClick={() => onConfirm(interval)}>
          {isSubmitting ? 'Redirigiendo…' : 'Continuar al pago'}
        </Button>
      </div>
    </Dialog>
  );
}
