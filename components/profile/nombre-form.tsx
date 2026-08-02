'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { updateNombre } from '@/lib/api/user-profile';
import { createClient } from '@/lib/supabase/client';

export interface NombreFormProps {
  /** The user's currently persisted `nombre` (server-side read), or `null` if never set. */
  nombreInicial: string | null
}

/**
 * `/profile` — lets the user set the display name used by the `/menu`
 * greeting (FRESCO-55). Empty/whitespace-only validation mirrors
 * `app/onboarding/page.tsx`'s `household_validation_message` pattern exactly
 * (disabled submit + inline `role="alert"` message), not a bespoke shape.
 */
export function NombreForm({ nombreInicial }: NombreFormProps) {
  const [nombre, setNombre] = useState(nombreInicial ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmed = nombre.trim();
  const isValid = trimmed.length > 0;

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
    }
    catch (error) {
      console.error('[NombreForm] updateNombre failed', error);
      setSaveError('No se pudo guardar tu nombre. Inténtalo de nuevo.');
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
            }}
            className={!isValid ? 'border-error' : ''}
          />
          {!isValid && (
            <p data-testid="nombre_validation_message" role="alert" aria-live="polite" className="text-body-sm text-error">
              Indica un nombre para guardar.
            </p>
          )}
          {saveError && (
            <p data-testid="nombre_save_error_message" role="alert" aria-live="assertive" className="text-body-sm text-error">
              {saveError}
            </p>
          )}
          {saved && (
            <p data-testid="nombre_saved_message" role="status" aria-live="polite" className="text-body-sm text-tertiary">
              Nombre guardado.
            </p>
          )}
          <div>
            <Button type="submit" variant="action" disabled={!isValid || isSaving} data-testid="guardar_nombre_button">
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
