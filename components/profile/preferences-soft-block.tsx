import type { NivelExperienciaCulinaria, ObjetivoUsuario, TipoCocina } from '@schemas';
import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import Link from 'next/link';
import { OptionCardGroup } from '@/components/ui/option-card-group';
import { Tag } from '@/components/ui/tag';
import { COCINA_OPTIONS, NIVEL_EXPERIENCIA_OPTIONS, OBJETIVO_OPTIONS } from '@/lib/onboarding/wizard-options';

/**
 * FRESCO-1282 — the goal, the cooking level and the favourite cuisines on `/profile/preferences`.
 * They lean the menu only for Pro (ADR-0071, the `isPro` gate in `generate-meal-plan`), so Pro edits
 * them and Free sees what it saved at onboarding, read-only, with a way to Pro. This is a screen rule,
 * not a data rule: Free still writes these three columns at onboarding, so the database does not
 * restrict them. Presentational: the form owns the state and the save.
 */

type SoftPreferences = Pick<OnboardingProfilePayload, 'objetivo' | 'nivel_experiencia' | 'cocinas_favoritas'>;

export interface SoftPreferencesBlockProps {
  isPro: boolean
  preferences: SoftPreferences
  onObjetivoChange: (value: ObjetivoUsuario) => void
  onNivelChange: (value: NivelExperienciaCulinaria) => void
  onCocinaToggle: (value: TipoCocina) => void
}

/** Order-independent: a cuisine toggled off and on again can land at another index. */
function sameCocinas(a: readonly string[], b: readonly string[]): boolean {
  const sortedB = [...b].sort();
  return a.length === b.length && [...a].sort().every((value, index) => value === sortedB[index]);
}

/** Whether the three soft preferences differ from what was loaded. Only meaningful for Pro. */
export function isSoftPreferencesDirty(current: SoftPreferences, initial: SoftPreferences): boolean {
  return (
    (current.objetivo ?? null) !== (initial.objetivo ?? null)
    || (current.nivel_experiencia ?? null) !== (initial.nivel_experiencia ?? null)
    || !sameCocinas(current.cocinas_favoritas, initial.cocinas_favoritas)
  );
}

const SIN_INDICAR = 'Sin indicar';

function EditableBlock({ preferences, onObjetivoChange, onNivelChange, onCocinaToggle }: Omit<SoftPreferencesBlockProps, 'isPro'>) {
  return (
    <section data-testid="preferencias_pro_bloque">
      <h2 className="mt-4 text-h6 uppercase text-tertiary">Objetivo, nivel y cocinas</h2>
      <p className="mt-1 text-body-sm text-tertiary">
        Con Pro, estas preferencias inclinan tu menú. Nunca dejan recetas fuera.
      </p>

      <span className="mt-3 block text-body-sm text-tertiary">Objetivo</span>
      <OptionCardGroup
        data-testid="preferencia_objetivo_group"
        aria-label="Objetivo"
        className="mt-1"
        options={OBJETIVO_OPTIONS}
        value={preferences.objetivo ?? null}
        onChange={onObjetivoChange}
      />

      <span className="mt-3 block text-body-sm text-tertiary">Nivel de experiencia culinaria</span>
      <OptionCardGroup
        data-testid="preferencia_nivel_group"
        aria-label="Nivel de experiencia culinaria"
        className="mt-1"
        columns={1}
        options={NIVEL_EXPERIENCIA_OPTIONS}
        value={preferences.nivel_experiencia ?? null}
        onChange={onNivelChange}
      />

      <span className="mt-3 block text-body-sm text-tertiary">Cocinas favoritas</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {COCINA_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            data-testid="preferencia_cocina_option"
            className="inline-flex min-h-11 items-center"
            aria-pressed={preferences.cocinas_favoritas.includes(option.value)}
            onClick={() => onCocinaToggle(option.value)}
          >
            <Tag variant={preferences.cocinas_favoritas.includes(option.value) ? 'selected' : 'outline'}>
              {option.label}
            </Tag>
          </button>
        ))}
      </div>
    </section>
  );
}

function LockedBlock({ preferences }: { preferences: SoftPreferences }) {
  const cocinas = COCINA_OPTIONS.filter(option => preferences.cocinas_favoritas.includes(option.value)).map(option => option.label);

  return (
    <section data-testid="preferencias_pro_bloqueado">
      <h2 className="mt-4 text-h6 uppercase text-tertiary">Objetivo, nivel y cocinas</h2>
      <dl className="mt-2 flex flex-col gap-1 text-body-sm">
        <div className="flex gap-2">
          <dt className="text-tertiary">Objetivo:</dt>
          <dd data-testid="preferencia_objetivo_valor">{OBJETIVO_OPTIONS.find(option => option.value === preferences.objetivo)?.label ?? SIN_INDICAR}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-tertiary">Nivel:</dt>
          <dd data-testid="preferencia_nivel_valor">{NIVEL_EXPERIENCIA_OPTIONS.find(option => option.value === preferences.nivel_experiencia)?.label ?? SIN_INDICAR}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-tertiary">Cocinas:</dt>
          <dd data-testid="preferencia_cocinas_valor">{cocinas.length > 0 ? cocinas.join(', ') : SIN_INDICAR}</dd>
        </div>
      </dl>
      <p data-testid="preferencias_pro_aviso" className="mt-2 text-body-sm text-tertiary">
        Con Pro, tu objetivo, tu nivel y tus cocinas favoritas inclinan el menú. Con tu plan actual se guardan, pero no lo cambian.
        {' '}
        <Link href="/profile" data-testid="preferencias_pro_enlace" className="underline">Conoce Pro</Link>
      </p>
    </section>
  );
}

export function SoftPreferencesBlock({ isPro, ...handlers }: SoftPreferencesBlockProps) {
  return isPro ? <EditableBlock {...handlers} /> : <LockedBlock preferences={handlers.preferences} />;
}
