'use client';

import type { FreeTextSuggestion, SuggestionKind } from '@/lib/onboarding/free-text-suggestions';
import * as React from 'react';
import { Tag } from '@/components/ui/tag';
import { ALERGENO_OPTIONS, INGREDIENTE_ODIADO_OPTIONS } from '@/lib/constants/dietary-options';
import { findSuggestions } from '@/lib/onboarding/free-text-suggestions';
import { UNSELECTED_CHIP_CLASS } from '@/lib/onboarding/wizard-options';
import { useOnboardingStore } from '@/lib/store/onboarding-store';

export interface FreeTextSuggestionsProps {
  /** The text of the box this list sits under. */
  text: string
  /** Which suggestions this box may offer. */
  kinds: SuggestionKind[]
  /** Prefix of the live region's data-testid (`<prefix>_sugerencias`). */
  testIdPrefix: string
}

/**
 * FRESCO-1228 — what the app understood from a free-text box, offered as chips
 * the person must confirm one by one. Nothing is applied on its own: the only
 * write is the confirm button, which does exactly what tapping the matching
 * chip above does. Until then the FRESCO-1000 warning under the box still
 * holds, and this copy says so instead of implying any protection.
 *
 * The list lives in a polite live region that is in the DOM before it has
 * content, so a screen reader announces suggestions as they appear.
 */
export function FreeTextSuggestions({ text, kinds, testIdPrefix }: FreeTextSuggestionsProps) {
  const alergenos = useOnboardingStore(state => state.alergenos);
  const ingredientesOdiados = useOnboardingStore(state => state.ingredientesOdiados);
  const [dismissed, setDismissed] = React.useState<ReadonlySet<string>>(new Set());

  // One chip per kind+value even if two typed words name it (almendras y avellanas);
  // dismissals are remembered per typed phrase, so a new phrase for the same value resurfaces.
  const shown = new Set<string>();
  const suggestions = findSuggestions(text, { kinds }).filter((s) => {
    if (dismissed.has(s.key)) { return false; }
    if (s.kind === 'alergeno' ? alergenos.includes(s.value) : ingredientesOdiados.includes(s.value)) { return false; }
    const id = `${s.kind}:${s.value}`;
    if (shown.has(id)) { return false; }
    shown.add(id);
    return true;
  });

  const confirm = (s: FreeTextSuggestion) => {
    const state = useOnboardingStore.getState();
    if (s.kind === 'alergeno') {
      if (!state.alergenos.includes(s.value)) { state.toggleAlergeno(s.value); }
    }
    else if (!state.ingredientesOdiados.includes(s.value)) {
      state.toggleIngredienteOdiado(s.value);
    }
  };

  const dismiss = (s: FreeTextSuggestion) => setDismissed(prev => new Set(prev).add(s.key));

  return (
    <div aria-live="polite" data-testid={`${testIdPrefix}_sugerencias`}>
      {suggestions.length > 0 && (
        <>
          <p className="mt-2 text-body-sm text-tertiary">
            Hemos reconocido esto en tu texto. No se aplica ningún filtro hasta que lo añadas tú.
          </p>
          <ul className="mt-1 flex flex-col gap-2">
            {suggestions.map((s) => {
              const options = s.kind === 'alergeno' ? ALERGENO_OPTIONS : INGREDIENTE_ODIADO_OPTIONS;
              const label = options.find(o => o.value === s.value)?.label ?? s.value;
              const what = s.kind === 'alergeno' ? 'alérgeno' : 'ingrediente a evitar';
              return (
                <li key={s.key} data-testid="texto_libre_sugerencia" data-kind={s.kind} data-value={s.value} className="flex flex-wrap items-center gap-2">
                  <span className="text-body-sm">{`Has escrito «${s.typed}»: ¿lo añadimos como ${what} (${label})?`}</span>
                  <span className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center"
                      data-testid="texto_libre_sugerencia_aceptar"
                      aria-label={`Añadir ${label} como ${what}`}
                      onClick={() => confirm(s)}
                    >
                      <Tag variant="outline">{`Añadir ${label}`}</Tag>
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center"
                      data-testid="texto_libre_sugerencia_descartar"
                      aria-label={`Descartar ${label} como ${what}`}
                      onClick={() => dismiss(s)}
                    >
                      <Tag variant="neutral" className={UNSELECTED_CHIP_CLASS}>Descartar</Tag>
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
