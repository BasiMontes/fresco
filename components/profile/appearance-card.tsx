import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * `/profile` — FRESCO-448 §Dark mode. The theme control lives in the desktop
 * sidebar footer, but the sidebar does not exist on mobile (bottom-tab nav),
 * so `/profile` carries the same control as a settings row for phone users.
 * Same self-contained-`Card` pattern as `PushNotificationsToggle`.
 * `ThemeToggle` owns all the state (cookie + `<html>` attribute); this is
 * just its placement.
 */
export function AppearanceCard() {
  return (
    <Card className="mt-4" data-testid="appearanceCard">
      <CardHeader>
        <CardTitle>Apariencia</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-label text-text">Tema</p>
            <p className="mt-0.5 text-body-sm text-tertiary">
              Claro, oscuro, o según tu sistema.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </CardContent>
    </Card>
  );
}
