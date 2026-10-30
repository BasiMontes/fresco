import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { AyudaSection } from '@/components/profile/ayuda-section';
import { LegalSection } from '@/components/profile/legal-section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { summarizePreferences } from '@/lib/profile/preferences-summary';

interface ProfilePreferencesAndHelpProps {
  dietaryPreferences: OnboardingProfilePayload
  email: string
  planLabel: string
  memberSince: string | null
}

/**
 * FRESCO-1070: two short cards of similar height. The long diet and allergen form moved to its own
 * page, `/profile/preferences`, and shows here as a "Preferencias" row with a one-line summary, so
 * the right column no longer sits empty next to a very tall form.
 *
 * FRESCO-451: found live while verifying the planning-grid scroll fade — a CSS grid item's default
 * min-width is `auto`, so without `min-w-0` a Card grew to fit its widest content instead of
 * shrinking to its track, pushing the whole PAGE into horizontal overflow.
 */
export function ProfilePreferencesAndHelp({ dietaryPreferences, email, planLabel, memberSince }: ProfilePreferencesAndHelpProps) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Preferencias y ayuda</CardTitle>
        </CardHeader>
        <CardContent>
          <AyudaSection
            email={email}
            planLabel={planLabel}
            memberSince={memberSince}
            preferencesSummary={summarizePreferences(dietaryPreferences)}
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
  );
}
