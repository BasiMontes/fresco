import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { AyudaSection } from '@/components/profile/ayuda-section';
import { PreferencesForm } from '@/components/profile/preferences-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProfilePreferencesAndHelpProps {
  dietaryPreferences: OnboardingProfilePayload
  email: string
  planLabel: string
  memberSince: string | null
}

export function ProfilePreferencesAndHelp({ dietaryPreferences, email, planLabel, memberSince }: ProfilePreferencesAndHelpProps) {
  return (
    /* FRESCO-451: found live while verifying the planning-grid scroll
       fade — a CSS grid item's default min-width is `auto`, so without
       `min-w-0` this Card grew to fit PlanningSelectionGrid's 304px
       table instead of shrinking to its grid track, pushing the whole
       PAGE into horizontal overflow rather than scrolling just the
       table inside it. */
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Preferencias</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferencesForm initialPreferences={dietaryPreferences} />
        </CardContent>
      </Card>

      {/* FRESCO-514 — whole-card scroll target for the sidebar account
          popover's plain "Ayuda" item (`/profile#ayuda`); distinct from
          the row-level `#ayuda-configuracion` target inside AyudaSection
          itself. */}
      <Card id="ayuda" className="min-w-0">
        <CardHeader>
          <CardTitle>Ayuda</CardTitle>
        </CardHeader>
        <CardContent>
          <AyudaSection
            email={email}
            planLabel={planLabel}
            memberSince={memberSince}
          />
        </CardContent>
      </Card>
    </div>
  );
}
