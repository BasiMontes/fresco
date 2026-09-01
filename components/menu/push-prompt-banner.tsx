'use client';

import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { clientEnv } from '@/lib/env';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { consumeFirstMenuSignal } from '@/lib/push/first-menu-signal';
import { isPushSupported, subscribeToPush, WebPushError } from '@/lib/push/web-push-client';
import { createClient } from '@/lib/supabase/client';

/**
 * FRESCO-372 (A4-H15): asks for push permission at the actual moment of
 * value — right after the first menu is generated — instead of the
 * pre-existing `PushNotificationsToggle` buried in `/profile` (0
 * subscriptions to date per the audit). `PushNotificationsToggle` stays as
 * the secondary, always-available path; this banner is a one-shot nudge.
 *
 * Gate is deliberately simple: the `sessionStorage` signal
 * (`consumeFirstMenuSignal`, set by onboarding's success path) narrows this
 * to "just generated her first menu", and `Notification.permission ===
 * 'default'` (never asked, this browser) is enough to know it is a genuine
 * first opportunity — no separate "is this her first-ever plan" query
 * needed, since a user who already answered (granted or denied) never sees
 * this again regardless of the signal.
 */
export function PushPromptBanner() {
  const [visible, setVisible] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!consumeFirstMenuSignal()) {
      return;
    }
    if (!isPushSupported() || Notification.permission !== 'default') {
      return;
    }
    setVisible(true);
    captureEvent(POSTHOG_EVENTS.PUSH_PROMPT_SHOWN);
    // Empty deps: this check only ever matters on the render right after the
    // onboarding redirect that set the signal — never re-run on re-render.
  }, []);

  if (!visible) {
    return null;
  }

  async function handleActivate() {
    setIsBusy(true);
    try {
      const vapidPublicKey = clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setVisible(false);
        return;
      }
      await subscribeToPush({ client: createClient(), vapidPublicKey });
      captureEvent(POSTHOG_EVENTS.PUSH_PERMISSION_GRANTED);
      setVisible(false);
    }
    catch (error) {
      // Denial or any other failure: just hide — she still has
      // `PushNotificationsToggle` in `/profile` if she changes her mind, and
      // browsers block re-prompting after a native denial anyway.
      if (!(error instanceof WebPushError)) {
        console.error('[PushPromptBanner] subscribeToPush failed', error);
      }
      setVisible(false);
    }
    finally {
      setIsBusy(false);
    }
  }

  return (
    <Card data-testid="push_prompt_banner" className="mt-4 border-2 border-primary">
      <CardContent className="flex flex-col items-start gap-3 text-body-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p>Te avisamos cuando sea buen momento para planificar tu próximo menú.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            data-testid="push_prompt_dismiss_button"
            disabled={isBusy}
            onClick={() => setVisible(false)}
            className={buttonVariants({ variant: 'ghost' })}
          >
            Ahora no
          </button>
          <button
            type="button"
            data-testid="push_prompt_activate_button"
            disabled={isBusy}
            onClick={() => {
              void handleActivate();
            }}
            className={buttonVariants({ variant: 'default' })}
          >
            Activar
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
