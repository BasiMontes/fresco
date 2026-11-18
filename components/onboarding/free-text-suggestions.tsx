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

function joinNames(names: string[]): string {
  if (names.length <= 1) { return names.join(''); }
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

function labelsOf(s: FreeTextSuggestion): string {
  const options = s.kind === 'alergeno' ? ALERGENO_OPTIONS : INGREDIENTE_ODIADO_OPTIONS;
  return joinNames(s.values.map(v => options.find(o => o.value === v)?.label ?? v));
}

const whatOf = (kind: SuggestionKind) => (kind === 'alergeno' ? 'alérgeno' : 'ingrediente a evitar');

/**
 * FRESCO-1228 — what the app understood from a free-text box, offered as chips
 * the person must confirm one by one. Nothing is applied on its own: the only
 * write is the confirm button, which does what tapping the matching chip(s)
 * above does. Until then the FRESCO-1000 warning under the box still holds, and
 * this copy says so instead of implying any protection.
 *
 * One typed word that implies several allergens (marisco) is ONE suggestion that
 * adds all of them with one click: never a half-protected state.
 *
 * The container is a polite live region that is in the DOM before it has
 * content, so a screen reader announces suggestions and the confirmation
 * message. After a click, focus moves to the next suggestion or, if none is
 * left, to the container itself (it never falls back to `body`).
 */
export function FreeTextSuggestions({ text, kinds, testIdPrefix }: FreeTextSuggestionsProps) {
  const alergenos = useOnboardingStore(state => state.alergenos);
  const ingredientesOdiados = useOnboardingStore(state => state.ingredientesOdiados);
  const [dismissed, setDismissed] = React.useState<ReadonlySet<string>>(new Set());
  // The message belongs to the text it was produced at; edited text drops it.
  const [announcement, setAnnouncement] = React.useState<{ text: string, message: string } | null>(null);
  const [focusRequest, setFocusRequest] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Order matters: (1) drop values already selected, (2) dedupe by kind+value so a
  // value is owned by its FIRST typed phrase, (3) only then apply dismissals. Dismissing
  // «almendras» therefore never surfaces «avellanas» for the same allergen.
  const owned = new Set<string>();
  const suggestions: FreeTextSuggestion[] = [];
  for (const s of findSuggestions(text, { kinds })) {
    const selected = s.kind === 'alergeno' ? alergenos : ingredientesOdiados;
    const values = s.values.filter(v => !selected.includes(v) && !owned.has(`${s.kind}:${v}`));
    if (values.length === 0) { continue; }
    values.forEach(v => owned.add(`${s.kind}:${v}`));
    if (dismissed.has(s.key)) { continue; }
    suggestions.push({ ...s, values });
  }

  React.useEffect(() => {
    if (focusRequest === 0) { return; }
    const next = containerRef.current?.querySelector<HTMLElement>('[data-testid="texto_libre_sugerencia_aceptar"]');
    (next ?? containerRef.current)?.focus();
  }, [focusRequest]);

  const confirm = (s: FreeTextSuggestion) => {
    // Written straight to the store, not through the chip toggles: a value locked
    // by a diet flag would make `toggleAlergeno` a silent no-op.
    useOnboardingStore.setState((state) => {
      const field = s.kind === 'alergeno' ? 'alergenos' : 'ingredientesOdiados';
      const current = state[field];
      return { [field]: [...current, ...s.values.filter(v => !current.includes(v))] };
    });
    setAnnouncement({ text, message: `Añadido a tus ${s.kind === 'alergeno' ? 'alérgenos' : 'ingredientes a evitar'}: ${labelsOf(s)}.` });
    setFocusRequest(n => n + 1);
  };

  const dismiss = (s: FreeTextSuggestion) => {
    setDismissed(prev => new Set(prev).add(s.key));
    setAnnouncement({ text, message: 'Sugerencia descartada: no se ha añadido nada.' });
    setFocusRequest(n => n + 1);
  };

  const message = announcement && announcement.text === text ? announcement.message : '';

  return (
    <div ref={containerRef} tabIndex={-1} aria-live="polite" data-testid={`${testIdPrefix}_sugerencias`} className="outline-hidden">
      {message && <p data-testid="texto_libre_sugerencia_mensaje" className="mt-2 text-body-sm">{message}</p>}
      {suggestions.length > 0 && (
        <>
          <p className="mt-2 text-body-sm text-tertiary">
            Hemos reconocido esto en tu texto. No se aplica ningún filtro hasta que lo añadas tú.
          </p>
          <ul className="mt-1 flex flex-col gap-2">
            {suggestions.map((s) => {
              const label = labelsOf(s);
              const what = whatOf(s.kind);
              return (
                <li key={s.key} data-testid="texto_libre_sugerencia" data-kind={s.kind} data-values={s.values.join(',')} className="flex flex-wrap items-center gap-2">
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
