import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { AyudaSection } from '@/components/profile/ayuda-section';
import { LegalSection } from '@/components/profile/legal-section';
import { PreferencesForm } from '@/components/profile/preferences-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProfilePreferencesAndHelpProps {
  dietaryPreferences: OnboardingProfilePayload
  hasHealthDataConsent: boolean
  email: string
  planLabel: string
  memberSince: string | null
}

export function ProfilePreferencesAndHelp({ dietaryPreferences, hasHealthDataConsent, email, planLabel, memberSince }: ProfilePreferencesAndHelpProps) {
  return (
    /* FRESCO-1070: Preferencias takes the full width (it used to share a two-column
       grid with a five-row Ayuda list, which left the right column empty and the
       form squeezed), and the help rows split into two short cards of similar
       height below it.
       FRESCO-451: found live while verifying the planning-grid scroll fade — a
       CSS grid item's default min-width is `auto`, so without `min-w-0` a Card
       grew to fit PlanningSelectionGrid's 304px table instead of shrinking to
       its track, pushing the whole PAGE into horizontal overflow rather than
       scrolling just the table inside it. */
    <div className="mt-4 flex flex-col gap-4">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Preferencias</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferencesForm initialPreferences={dietaryPreferences} hasHealthDataConsent={hasHealthDataConsent} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
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

        <Card id="legal" className="min-w-0">
          <CardHeader>
            <CardTitle>Legal</CardTitle>
          </CardHeader>
          <CardContent>
            <LegalSection />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
