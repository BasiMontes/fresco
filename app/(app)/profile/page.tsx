import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';

/**
 * `/profile` — nav item 4. Tier status + a `card-pro` upsell for Free users.
 * Mock account data — real Supabase Auth wiring belongs to the backend
 * agent's session setup and `/sprint-development` story work.
 */
export default function ProfilePage() {
  const mockUser = { nombre: 'Laura', email: 'laura@example.com', tier: 'free' as const };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-h2">Perfil</h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{mockUser.nombre}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-body-sm text-tertiary">
          {mockUser.email}
          <Tag variant={mockUser.tier === 'free' ? 'neutral' : 'accent'}>
            {mockUser.tier === 'free' ? 'Plan Free' : 'Plan Pro'}
          </Tag>
        </CardContent>
      </Card>

      {mockUser.tier === 'free' && (
        <Card variant="pro" className="mt-4">
          <CardHeader>
            <CardTitle>Pásate a Fresco Pro</CardTitle>
          </CardHeader>
          <CardContent className="text-body-sm text-tertiary">
            Con Pro, cada menú aprende de lo que cocinas y descartas la semana anterior — cuanto
            más lo uses, menos tienes que pensar.
          </CardContent>
          <div className="mt-3">
            <a href="#" className={buttonVariants({ variant: 'action' })}>
              Mejorar a Pro
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}
