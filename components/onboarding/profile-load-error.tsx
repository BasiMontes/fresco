import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * FRESCO-806: shown instead of the wizard when the user's saved profile could
 * not be read. An empty wizard here would let "Empezar" overwrite that profile.
 */
export function ProfileLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div data-testid="onboardingPage" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
      <Card className="p-6 md:p-8">
        <h1 className="text-h4">No hemos podido cargar tu perfil</h1>
        <p role="alert" data-testid="onboarding_profile_load_error" className="mt-2 text-body-md text-tertiary">
          Para no pisar tus preferencias guardadas, no abrimos el asistente hasta poder leerlas. Inténtalo de nuevo.
        </p>
        <Button type="button" data-testid="onboarding_profile_retry_button" className="mt-4" onClick={onRetry}>
          Reintentar
        </Button>
      </Card>
    </div>
  );
}
