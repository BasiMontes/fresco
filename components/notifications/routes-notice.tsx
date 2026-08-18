'use client';

import { BookOpen, Calendar, Home, ShoppingCart, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { markRoutesNoticeDismissed } from '@/lib/api/user-profile';
import { createClient } from '@/lib/supabase/client';

/** Same icon/label/route triplet as `components/layout/sidebar.tsx`'s Menú/Calendario/Lista items. */
const ROUTES = [
  { href: '/menu', label: 'Menú', icon: Home },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/shopping-list', label: 'Lista de la compra', icon: ShoppingCart },
] as const;

/**
 * Centro de Avisos main-routes notice (FRESCO-225). Static links to the
 * app's 3 core sections, dismissible — the dismiss persists server-side
 * (via `markRoutesNoticeDismissed`) so it never comes back, same one-way
 * pattern as FRESCO-224's welcome notice, just user-triggered instead of
 * auto-marked on render since this one needs an explicit "descartar" action.
 *
 * Hidden locally as soon as the dismiss click fires (optimistic) — a persist
 * failure just means it may show once more on a later visit, same
 * conservative-default trade-off as every other read/write pair in
 * `lib/api/user-profile.ts`.
 */
export function RoutesNotice() {
  const [visible, setVisible] = useState(true);

  if (!visible) { return null; }

  return (
    <Card className="mt-6" data-testid="notifications_routes_notice">
      <CardHeader className="mb-0 flex-row items-start justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" aria-hidden="true" />
          <CardTitle>Explora Fresco</CardTitle>
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            markRoutesNoticeDismissed(createClient()).catch((error) => {
              console.error('[RoutesNotice] markRoutesNoticeDismissed failed', error);
            });
          }}
          className="text-tertiary hover:text-text"
          aria-label="Descartar aviso"
          data-testid="notifications_routes_notice_dismiss"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {ROUTES.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-full px-3 py-2 text-label font-sans text-text hover:bg-neutral-100"
          >
            <Icon className="size-[18px]" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
