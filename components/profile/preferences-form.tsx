'use client';

import type { DiaSemana, TipoPlatoSlot } from '@schemas';
import type { FormEvent } from 'react';
import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { upsertUserProfile } from '@/lib/api/user-profile';
import { ALERGENO_OPTIONS } from '@/lib/constants/dietary-options';
import { createClient } from '@/lib/supabase/client';

export interface PreferencesFormProps {
  /**
   * Full onboarding profile (server-side read), so a save preserves every
   * field this form doesn't expose — see `getUserDietaryPreferences`'s doc
   * comment.
   */
  initialPreferences: OnboardingProfilePayload
}

type DietaKey = 'dieta_vegetariano' | 'dieta_vegano' | 'dieta_sin_gluten' | 'dieta_sin_lactosa' | 'dieta_sin_huevo' | 'dieta_keto' | 'dieta_halal';

const DIETA_FIELDS: { key: DietaKey, label: string }[] = [
  { key: 'dieta_vegetariano', label: 'Vegetariano' },
  { key: 'dieta_vegano', label: 'Vegano' },
  { key: 'dieta_sin_gluten', label: 'Sin gluten' },
  { key: 'dieta_sin_lactosa', label: 'Sin lactosa' },
  { key: 'dieta_sin_huevo', label: 'Sin huevo' },
  { key: 'dieta_keto', label: 'Keto' },
  { key: 'dieta_halal', label: 'Halal' },
];

// FRESCO-153: same option sets + labels as app/onboarding/page.tsx Step 4
// (MEAL_OPTIONS/DAY_OPTIONS) — kept editable here so a choice made at
// onboarding isn't locked in forever.
const MEAL_OPTIONS: { value: TipoPlatoSlot, label: string }[] = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida', label: 'Almuerzo' },
  { value: 'cena', label: 'Cena' },
];

const DAY_OPTIONS: { value: DiaSemana, label: string }[] = [
  { value: 'lunes', label: 'Lun' },
  { value: 'martes', label: 'Mar' },
  { value: 'miercoles', label: 'Mié' },
  { value: 'jueves', label: 'Jue' },
  { value: 'viernes', label: 'Vie' },
  { value: 'sabado', label: 'Sáb' },
  { value: 'domingo', label: 'Dom' },
];

const ALL_MEALS: TipoPlatoSlot[] = MEAL_OPTIONS.map(option => option.value);
const ALL_DAYS: DiaSemana[] = DAY_OPTIONS.map(option => option.value);

/**
 * `/profile` — lets the user edit the dietary preferences captured at
 * onboarding (FRESCO-70). Chip interaction (toggle pills, "vegana implies
 * vegetariana" lock) is lifted straight from `app/onboarding/page.tsx` Step
 * 1, not reinvented — same labels, same `Tag`/`aria-pressed` pattern, same
 * lock rule (AC-2 there). Save/error/success states mirror
 * `components/profile/nombre-form.tsx` exactly.
 *
 * The dietary flags, `alergenos`, and (FRESCO-153) `planning_meals`/
 * `planning_days` are editable here — household size, disliked ingredients,
 * and favorite cuisines stay onboarding-only for this story, but their
 * current values are still carried in `preferences` state so a save
 * round-trips them unchanged through `upsertUserProfile`.
 */
export function PreferencesForm({ initialPreferences }: PreferencesFormProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleDieta(key: DietaKey) {
    setSaved(false);
    setPreferences((prev) => {
      // AC-2 (onboarding Step 1): "vegana" always implies "vegetariana" —
      // the vegetariano chip stays locked selected while vegano is active.
      if (key === 'dieta_vegetariano' && prev.dieta_vegano) {
        return prev;
      }
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'dieta_vegano' && next.dieta_vegano) {
        next.dieta_vegetariano = true;
      }
      return next;
    });
  }

  function toggleAlergeno(value: string) {
    setSaved(false);
    setPreferences(prev => ({
      ...prev,
      alergenos: prev.alergenos.includes(value)
        ? prev.alergenos.filter(v => v !== value)
        : [...prev.alergenos, value],
    }));
  }

  function toggleMeal(value: TipoPlatoSlot) {
    setSaved(false);
    setPreferences((prev) => {
      const current = prev.planning_meals ?? ALL_MEALS;
      return {
        ...prev,
        planning_meals: current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value],
      };
    });
  }

  function toggleDay(value: DiaSemana) {
    setSaved(false);
    setPreferences((prev) => {
      const current = prev.planning_days ?? ALL_DAYS;
      return {
        ...prev,
        planning_days: current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value],
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const client = createClient();
      await upsertUserProfile(client, preferences);
      setSaved(true);
    }
    catch (error) {
      console.error('[PreferencesForm] upsertUserProfile failed', error);
      setSaveError('No se pudieron guardar tus preferencias. Inténtalo de nuevo.');
    }
    finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      data-testid="preferencesForm"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <h4 className="text-h6 uppercase text-tertiary">Dieta y restricciones</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {DIETA_FIELDS.map((field) => {
          const isLocked = field.key === 'dieta_vegetariano' && preferences.dieta_vegano;
          return (
            <button
              key={field.key}
              type="button"
              data-testid="preferencia_dieta_option"
              disabled={isLocked}
              aria-pressed={preferences[field.key]}
              onClick={() => toggleDieta(field.key)}
            >
              <Tag variant={preferences[field.key] ? 'selected' : 'outline'}>
                {field.label}
              </Tag>
            </button>
          );
        })}
      </div>

      <h4 className="mt-4 text-h6 uppercase text-tertiary">Alérgenos a evitar</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {ALERGENO_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            data-testid="preferencia_alergeno_option"
            aria-pressed={preferences.alergenos.includes(option.value)}
            onClick={() => toggleAlergeno(option.value)}
          >
            <Tag variant={preferences.alergenos.includes(option.value) ? 'selected' : 'outline'}>
              {option.label}
            </Tag>
          </button>
        ))}
      </div>

      {/* FRESCO-153: was set at onboarding (FRESCO-135/136) but never
          editable afterward — same Tag-toggle pattern as onboarding Step 4. */}
      <h4 className="mt-4 text-h6 uppercase text-tertiary">Comidas a planificar</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {MEAL_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            data-testid="preferencia_comida_option"
            aria-pressed={(preferences.planning_meals ?? ALL_MEALS).includes(option.value)}
            onClick={() => toggleMeal(option.value)}
          >
            <Tag variant={(preferences.planning_meals ?? ALL_MEALS).includes(option.value) ? 'selected' : 'outline'}>
              {option.label}
            </Tag>
          </button>
        ))}
      </div>

      <h4 className="mt-4 text-h6 uppercase text-tertiary">Días a planificar</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {DAY_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            data-testid="preferencia_dia_option"
            aria-pressed={(preferences.planning_days ?? ALL_DAYS).includes(option.value)}
            onClick={() => toggleDay(option.value)}
          >
            <Tag variant={(preferences.planning_days ?? ALL_DAYS).includes(option.value) ? 'selected' : 'outline'}>
              {option.label}
            </Tag>
          </button>
        ))}
      </div>

      {saveError && (
        <p data-testid="preferencias_save_error_message" role="alert" aria-live="assertive" className="mt-3 text-body-sm text-error">
          {saveError}
        </p>
      )}
      {saved && (
        <p data-testid="preferencias_saved_message" role="status" aria-live="polite" className="mt-3 text-body-sm text-tertiary">
          Preferencias guardadas.
        </p>
      )}

      <div className="mt-4">
        <Button type="submit" variant="action" disabled={isSaving} data-testid="actualizar_preferencias_button">
          {isSaving ? 'Guardando…' : 'Actualizar Preferencias'}
        </Button>
      </div>
    </form>
  );
}
