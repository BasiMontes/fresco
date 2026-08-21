'use client';

import type { FormEvent } from 'react';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { updateNombre } from '@/lib/api/user-profile';
import { createClient } from '@/lib/supabase/client';

/**
 * FRESCO-248 — reads a `--shake-*`/`--revert-*` CSS custom property off
 * `:root` with a numeric fallback, same helper shape as
 * `transitions-dev`'s own `12-error-state-shake.md` JS orchestration
 * snippet. `getComputedStyle` does NOT reliably keep the `ms` unit —
 * Chromium serializes `--revert-hold: 3000ms` as `"3s"`, and a plain
 * `parseFloat` reads that as `3` instead of `3000` (same quirk documented
 * in `favorite-toggle-button.tsx`'s `readCssTimeMs`, caught live here via
 * FRESCO-248's Stage 3 validation pass).
 */
function readMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return raw.endsWith('ms') ? value : value * 1000;
}

export interface NombreFormProps {
  /** The user's currently persisted `nombre` (server-side read), or `null` if never set. */
  nombreInicial: string | null
}

/**
 * `/profile` — lets the user set the display name used by the `/menu`
 * greeting (FRESCO-55). Empty/whitespace-only validation mirrors
 * `app/onboarding/page.tsx`'s `household_validation_message` pattern exactly
 * (disabled submit + inline `role="alert"` message), not a bespoke shape —
 * including that pattern's silent-until-touched start: `household` there
 * defaults to a valid 2 adults/0 kids, so its error never shows on mount.
 * This field has no valid default for a first-time user (`nombreInicial ===
 * null`), so it needs an explicit `touched` gate to get the same
 * silent-on-first-paint behavior.
 */
export function NombreForm({ nombreInicial }: NombreFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [touched, setTouched] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLButtonElement>(null);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FRESCO-248 — imperative DOM classList toggling (not React state) is
  // required here: the shake needs a remove -> reflow -> re-add sequence to
  // replay on a second failed save, and two state updates in the same
  // handler would batch into one render, never painting the removed class.
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

  const trimmed = nombre.trim();
  const isValid = trimmed.length > 0;
  // FRESCO-217: `nombreInicial` is the persisted value (this component's own
  // `handleSubmit` calls `router.refresh()` after a save, so the prop itself
  // advances to the newly-saved name) — comparing straight against the prop
  // rather than a separate snapshot ref keeps "saved" and "unchanged" the
  // same disabled state without extra bookkeeping.
  const isDirty = trimmed !== (nombreInicial ?? '').trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const client = createClient();
      await updateNombre(client, trimmed);
      setSaved(true);
      // FRESCO-179: /profile's greeting card and the sidebar both read
      // `nombre` server-side (AppGroupLayout, /profile page.tsx) — without
      // this, the save persists but those stay stale until a manual reload.
      router.refresh();
    }
    catch (error) {
      console.error('[NombreForm] updateNombre failed', error);
      setSaveError('No se pudo guardar tu nombre. Inténtalo de nuevo.');
      showError();
    }
    finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="mt-4" data-testid="nombreForm">
      <CardHeader>
        <CardTitle>Tu nombre</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="flex flex-col gap-2"
        >
          <Input
            data-testid="nombre_input"
            type="text"
            placeholder="¿Cómo te llamamos?"
            value={nombre}
            onChange={(event) => {
              setNombre(event.target.value);
              setSaved(false);
              setTouched(true);
              // FRESCO-248: typing after a shown error cancels the
              // auto-revert and clears it immediately, mirroring the
              // snippet's own "typing cancels the auto-revert" note.
              clearError();
            }}
            className={touched && !isValid ? 'border-error' : ''}
          />
          {touched && !isValid && (
            <p data-testid="nombre_validation_message" role="alert" aria-live="polite" className="text-body-sm text-error">
              Indica un nombre para guardar.
            </p>
          )}
          {saved && (
            <div className="flex items-center gap-1.5">
              <span className="t-success-check" data-state="in" aria-hidden="true" data-testid="nombre_saved_check">
                <Check className="size-4 text-success" strokeWidth={3} />
              </span>
              <p data-testid="nombre_saved_message" role="status" aria-live="polite" className="text-body-sm text-tertiary">
                Nombre guardado.
              </p>
            </div>
          )}
          <div className="t-input-wrap" ref={wrapRef} data-testid="nombre_save_wrap">
            <Button type="submit" variant="action" disabled={!isValid || isSaving || !isDirty} data-testid="guardar_nombre_button" className="t-input" ref={inputRef}>
              Guardar
            </Button>
            <p data-testid="nombre_save_error_message" role="alert" aria-live="assertive" className="t-error-msg mt-1 text-body-sm text-error">
              {saveError}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
