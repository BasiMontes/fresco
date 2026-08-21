'use client';

import type { DiaSemana, TipoPlatoSlot } from '@schemas';
import type { FormEvent } from 'react';
import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { upsertUserProfile } from '@/lib/api/user-profile';
import { ALERGENO_OPTIONS } from '@/lib/constants/dietary-options';
import { fromPlanningSelection, toPlanningSelection } from '@/lib/planning-selection';
import { createClient } from '@/lib/supabase/client';

/**
 * FRESCO-248 — reads a `--shake-*`/`--revert-*` CSS custom property off
 * `:root` with a numeric fallback, same helper shape as
 * `transitions-dev`'s own `12-error-state-shake.md` JS orchestration
 * snippet. Mirrors `components/profile/nombre-form.tsx`'s copy — see that
 * file's Save/error/success comment for why this stays local, not shared.
 * `getComputedStyle` does NOT reliably keep the `ms` unit — Chromium
 * serializes `--revert-hold: 3000ms` as `"3s"`, and a plain `parseFloat`
 * reads that as `3` instead of `3000` (same quirk documented in
 * `favorite-toggle-button.tsx`'s `readCssTimeMs`).
 */
function readMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return raw.endsWith('ms') ? value : value * 1000;
}

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
// FRESCO-199: fallback for a profile read before `planning_selection` existed.
const DEFAULT_PLANNING_SELECTION = toPlanningSelection(ALL_DAYS, ALL_MEALS);

/**
 * Order-independent equality — the toggle handlers below don't guarantee a
 * value re-added after removal lands back at its original array index, so a
 * plain index-by-index (or `JSON.stringify`) comparison would report a
 * revert-to-original edit as still dirty.
 */
function sameValues(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

/**
 * FRESCO-216: only the fields this form actually exposes can go dirty —
 * `num_personas`/`adultos`/`ninos`/`ingredientes_odiados`/`cocinas_favoritas`
 * (and the optional onboarding-only fields) round-trip through `preferences`
 * state unchanged, so comparing the full object would never disagree with
 * this narrower check but would also silently start relying on those fields
 * staying untouched forever.
 */
function isPreferencesDirty(current: OnboardingProfilePayload, initial: OnboardingProfilePayload): boolean {
  return (
    current.dieta_vegetariano !== initial.dieta_vegetariano
    || current.dieta_vegano !== initial.dieta_vegano
    || current.dieta_sin_gluten !== initial.dieta_sin_gluten
    || current.dieta_sin_lactosa !== initial.dieta_sin_lactosa
    || current.dieta_sin_huevo !== initial.dieta_sin_huevo
    || current.dieta_keto !== initial.dieta_keto
    || current.dieta_halal !== initial.dieta_halal
    || !sameValues(current.alergenos, initial.alergenos)
    || !sameValues(
      fromPlanningSelection(current.planning_selection ?? DEFAULT_PLANNING_SELECTION).meals,
      fromPlanningSelection(initial.planning_selection ?? DEFAULT_PLANNING_SELECTION).meals,
    )
    || !sameValues(
      fromPlanningSelection(current.planning_selection ?? DEFAULT_PLANNING_SELECTION).days,
      fromPlanningSelection(initial.planning_selection ?? DEFAULT_PLANNING_SELECTION).days,
    )
  );
}

/**
 * `/profile` — lets the user edit the dietary preferences captured at
 * onboarding (FRESCO-70). Chip interaction (toggle pills, "vegana implies
 * vegetariana" lock) is lifted straight from `app/onboarding/page.tsx` Step
 * 1, not reinvented — same labels, same `Tag`/`aria-pressed` pattern, same
 * lock rule (AC-2 there). Save/error/success states mirror
 * `components/profile/nombre-form.tsx` exactly.
 *
 * The dietary flags, `alergenos`, and (FRESCO-153, FRESCO-199) the meal/day
 * planning selection are editable here — household size, disliked ingredients,
 * and favorite cuisines stay onboarding-only for this story, but their
 * current values are still carried in `preferences` state so a save
 * round-trips them unchanged through `upsertUserProfile`.
 */
export function PreferencesForm({ initialPreferences }: PreferencesFormProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLButtonElement>(null);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FRESCO-248 — same imperative classList replay as nombre-form.tsx; see
  // that file's comment for why this can't be plain React state.
  function showError() {
    const wrap = wrapRef.current;
    const input = inputRef.current;
    if (!wrap || !input) {
      return;
    }

    wrap.classList.add('is-error');
    input.classList.add('is-error');

    input.classList.remove('is-shaking');
    void input.offsetWidth; // force reflow
    input.classList.add('is-shaking');

    const shakeMs = readMs('--shake-dur-a', 80) * 2 + readMs('--shake-dur-b', 60) * 2;
    if (shakeTimerRef.current) {
      clearTimeout(shakeTimerRef.current);
    }
    shakeTimerRef.current = setTimeout(() => input.classList.remove('is-shaking'), shakeMs + 20);

    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
    }
    const hold = readMs('--revert-hold', 3000);
    revertTimerRef.current = setTimeout(() => {
      revertTimerRef.current = null;
      wrap.classList.remove('is-error');
      input.classList.remove('is-error');
    }, shakeMs + hold);
  }

  function clearError() {
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
    if (shakeTimerRef.current) {
      clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
    wrapRef.current?.classList.remove('is-error');
    inputRef.current?.classList.remove('is-error', 'is-shaking');
  }

  useEffect(() => () => {
    if (revertTimerRef.current) { clearTimeout(revertTimerRef.current); }
    if (shakeTimerRef.current) { clearTimeout(shakeTimerRef.current); }
  }, []);

  const isDirty = isPreferencesDirty(preferences, initialPreferences);
  const { days: selectedDays, meals: selectedMeals } = fromPlanningSelection(preferences.planning_selection ?? DEFAULT_PLANNING_SELECTION);

  function toggleDieta(key: DietaKey) {
    setSaved(false);
    clearError();
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
    clearError();
    setPreferences(prev => ({
      ...prev,
      alergenos: prev.alergenos.includes(value)
        ? prev.alergenos.filter(v => v !== value)
        : [...prev.alergenos, value],
    }));
  }

  // FRESCO-199: these two toggles still edit the "whole week" flat view —
  // every included day gets every included meal — since the granular
  // per-day picker is a separate follow-up. `toPlanningSelection`/
  // `fromPlanningSelection` are the boundary conversion to/from the DB's
  // day->meals matrix. WARNING for whoever builds the per-day picker: once
  // `planning_selection` can be asymmetric (a day with a different meal set
  // than the rest), touching EITHER toggle here re-flattens the whole week
  // to `nextMeals`/`nextDays`, silently destroying that day's distinct
  // selection. Guard against that before shipping the picker.
  function toggleMeal(value: TipoPlatoSlot) {
    setSaved(false);
    clearError();
    setPreferences((prev) => {
      const { days, meals } = fromPlanningSelection(prev.planning_selection ?? DEFAULT_PLANNING_SELECTION);
      const nextMeals = meals.includes(value) ? meals.filter(v => v !== value) : [...meals, value];
      return { ...prev, planning_selection: toPlanningSelection(days, nextMeals) };
    });
  }

  function toggleDay(value: DiaSemana) {
    setSaved(false);
    clearError();
    setPreferences((prev) => {
      const { days, meals } = fromPlanningSelection(prev.planning_selection ?? DEFAULT_PLANNING_SELECTION);
      const nextDays = days.includes(value) ? days.filter(v => v !== value) : [...days, value];
      return { ...prev, planning_selection: toPlanningSelection(nextDays, meals) };
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
      showError();
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
            aria-pressed={selectedMeals.includes(option.value)}
            onClick={() => toggleMeal(option.value)}
          >
            <Tag variant={selectedMeals.includes(option.value) ? 'selected' : 'outline'}>
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
            aria-pressed={selectedDays.includes(option.value)}
            onClick={() => toggleDay(option.value)}
          >
            <Tag variant={selectedDays.includes(option.value) ? 'selected' : 'outline'}>
              {option.label}
            </Tag>
          </button>
        ))}
      </div>

      {saved && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className="t-success-check" data-state="in" aria-hidden="true" data-testid="preferencias_saved_check">
            <Check className="size-4 text-success" strokeWidth={3} />
          </span>
          <p data-testid="preferencias_saved_message" role="status" aria-live="polite" className="text-body-sm text-tertiary">
            Preferencias guardadas.
          </p>
        </div>
      )}

      <div className="t-input-wrap mt-4" ref={wrapRef} data-testid="preferencias_save_wrap">
        <Button type="submit" variant="action" disabled={isSaving || !isDirty} data-testid="actualizar_preferencias_button" className="t-input" ref={inputRef}>
          {isSaving ? 'Guardando…' : 'Actualizar Preferencias'}
        </Button>
        <p data-testid="preferencias_save_error_message" role="alert" aria-live="assertive" className="t-error-msg mt-1 text-body-sm text-error">
          {saveError}
        </p>
      </div>
    </form>
  );
}
