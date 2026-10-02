'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { clientEnv } from '@/lib/env';
import { getCurrentPushSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush, WebPushError } from '@/lib/push/web-push-client';
import { createClient } from '@/lib/supabase/client';

type ToggleStatus = 'checking' | 'off' | 'on' | 'unsupported' | 'denied' | 'unconfigured' | 'guest';

interface PushNotificationsToggleProps {
  /** FRESCO-779: guest (anonymous) sessions cannot store a push subscription, so the control is disabled for them. */
  isGuest?: boolean
}

/**
 * `/profile` — FRESCO-241 PR2. Opt-in toggle for the weekly re-engagement
 * push notification. Same settings-area pattern as `NombreForm` /
 * `PreferencesForm` (self-contained `Card`, inline error text under the
 * action), minus the FRESCO-248 shake choreography — that snippet targets a
 * save button reverting a form value; a switch failing to flip has no
 * "value" to revert, an inline error line is enough here.
 */
export function PushNotificationsToggle({ isGuest = false }: PushNotificationsToggleProps = {}) {
  const [status, setStatus] = useState<ToggleStatus>(isGuest ? 'guest' : 'checking');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkInitialState() {
      if (isGuest) {
        return;
      }

      if (!isPushSupported()) {
        if (!cancelled) {
          setStatus('unsupported');
        }
        return;
      }

      if (Notification.permission === 'denied') {
        if (!cancelled) {
          setStatus('denied');
        }
        return;
      }

      const subscription = await getCurrentPushSubscription();
      if (cancelled) {
        return;
      }
      setStatus(subscription ? 'on' : 'off');
    }

    void checkInitialState();

    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  async function handleToggle() {
    if (isBusy || status === 'checking' || status === 'unsupported' || status === 'denied' || status === 'unconfigured' || status === 'guest') {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      if (status === 'on') {
        await unsubscribeFromPush(createClient());
        setStatus('off');
      }
      else {
        const vapidPublicKey = clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          setStatus('unconfigured');
          return;
        }
        await subscribeToPush({ client: createClient(), vapidPublicKey });
        setStatus('on');
      }
    }
    catch (caughtError) {
      console.error('[PushNotificationsToggle] toggle failed', caughtError);
      // A denial surfaces through `subscribeToPush` as a `WebPushError` too
      // (not just the pre-mount check above) — the user can deny the native
      // prompt on THIS click, not just on a prior visit.
      if (caughtError instanceof WebPushError && caughtError.message.includes('permiso')) {
        setStatus('denied');
        return;
      }
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo actualizar tus recordatorios. Inténtalo de nuevo.',
      );
    }
    finally {
      setIsBusy(false);
    }
  }

  const isOn = status === 'on';
  const isDisabled = isBusy || status === 'checking' || status === 'unsupported' || status === 'denied' || status === 'unconfigured' || status === 'guest';

  return (
    <Card className="mt-4" data-testid="pushNotificationsToggle">
      <CardHeader>
        <CardTitle>Notificaciones</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-body-md">Recordatorios semanales</p>
            <p className="text-body-sm text-tertiary" data-testid="push_notifications_description">
              {status === 'guest' && 'Crea una cuenta para recibir recordatorios semanales.'}
              {status === 'unsupported' && 'Tu navegador no admite notificaciones push.'}
              {status === 'unconfigured' && 'Las notificaciones push todavía no están configuradas.'}
              {status === 'denied' && 'Has bloqueado las notificaciones. Actívalas desde los ajustes del navegador para recibir recordatorios.'}
              {(status === 'on' || status === 'off' || status === 'checking') && 'Recibe un aviso cuando sea buen momento para planificar tu menú de la semana.'}
            </p>
          </div>
          <Switch
            checked={isOn}
            onCheckedChange={() => {
              void handleToggle();
            }}
            disabled={isDisabled}
            aria-label="Recordatorios semanales"
            data-testid="push_notifications_switch"
          />
        </div>
        {error && (
          <p role="alert" aria-live="assertive" className="mt-2 text-body-sm text-error" data-testid="push_notifications_error_message">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
