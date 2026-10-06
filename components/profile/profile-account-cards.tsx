import { AccountActions, DangerZone } from '@/components/profile/danger-zone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProfileAccountCardsProps {
  email: string
  isAnonymous: boolean
}

export function ProfileAccountCards({ email, isAnonymous }: ProfileAccountCardsProps) {
  return (
    <>
      {/* FRESCO-220: logout + CSV export moved out of the danger-styled
          card below — neither is a destructive action. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountActions />
        </CardContent>
      </Card>

      <Card variant="danger" className="mt-4">
        <CardHeader>
          <CardTitle>Zona de peligro</CardTitle>
        </CardHeader>
        <CardContent>
          <DangerZone email={email} isAnonymous={isAnonymous} />
        </CardContent>
      </Card>
    </>
  );
}
