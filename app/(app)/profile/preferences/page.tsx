import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PreferencesForm } from '@/components/profile/preferences-form';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getAuthUser } from '@/lib/auth/current-user';
import { loadPreferencesPageData } from '@/lib/profile/load-profile-page-data';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

// FRESCO-966: per-route tab title (WCAG 2.4.2); the root layout title is the fallback.
export const metadata: Metadata = { title: 'Preferencias · Fresco' };

/**
 * `/profile/preferences` (FRESCO-1070) — the diet, allergen and meal-planning form, moved off
 * `/profile` where it shared a two-column grid with a short Ayuda list. The form itself is
 * unchanged, including the health-data consent it asks for before saving. Session access is the
 * `(app)` layout's, the same as `/profile`.
 */
export default async function ProfilePreferencesPage() {
  const supabase = await createClient();
  // FRESCO-483: shared verified session read (React.cache) — no extra GoTrue round trip.
  const { data: { user } } = await getAuthUser();

  const { dietaryPreferences, hasHealthDataConsent } = await loadPreferencesPageData(supabase, user?.id);

  return (
    <div className="mx-auto max-w-4xl">
      {/* FRESCO-451: the icon-only circular back button shared by favorites, notifications and historial. */}
      <div className="flex items-center gap-3">
        <Link
          href="/profile"
          data-testid="preferences_back_link"
          aria-label="Volver al perfil"
          className={cn(buttonVariants({ variant: 'icon', size: 'sm' }), 'shrink-0')}
        >
          <ArrowLeft className="size-6" aria-hidden="true" />
        </Link>
        <h1 className="text-h2">Preferencias</h1>
      </div>

      <Card className="mt-4">
        <CardContent>
          <PreferencesForm initialPreferences={dietaryPreferences} hasHealthDataConsent={hasHealthDataConsent} />
        </CardContent>
      </Card>
    </div>
  );
}
