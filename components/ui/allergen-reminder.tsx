import { ALERGENOS_RECORDATORIO } from '@/lib/constants/dietary-options';
import { cn } from '@/lib/utils';

/**
 * FRESCO-1000 (audit 7b A7-LAUNCH-03): the allergen reminder on the menu and on every recipe. One component and
 * one text so the wording cannot drift between screens; the onboarding keeps its own, longer
 * `ALERGENOS_AVISO` next to the allergen chips.
 */
export function AllergenReminder({ className }: { className?: string }) {
  return (
    <p data-testid="alergenos_recordatorio" className={cn('text-body-sm text-tertiary', className)}>
      {ALERGENOS_RECORDATORIO}
    </p>
  );
}
