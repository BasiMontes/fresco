'use client';

import type * as React from 'react';
import { Input } from '@/components/ui/input';
import { OptionCardGroup } from '@/components/ui/option-card-group';
import { NIVEL_EXPERIENCIA_OPTIONS, OBJETIVO_OPTIONS } from '@/lib/onboarding/wizard-options';
import { useOnboardingStore } from '@/lib/store/onboarding-store';

export interface OnboardingStepIdentityProps {
  headingRef: React.RefObject<HTMLHeadingElement | null>
}

/**
 * FRESCO-132 — wizard step 1 (name, sex, goal, experience level). Extracted
 * from `app/onboarding/page.tsx` (A5-M1, god-component split) — reads/writes
 * the shared `useOnboardingStore()` directly (same pattern as other
 * store-connected components in this repo), no behavior change from the
 * original inline JSX.
 */
export function OnboardingStepIdentity({ headingRef }: OnboardingStepIdentityProps) {
  const { nombre, objetivo, nivelExperiencia, setNombre, setObjetivo, setNivelExperiencia } = useOnboardingStore();

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="text-h3 outline-hidden">Cuéntanos sobre ti</h1>
      <p className="mt-1 text-body-sm text-tertiary">Nos ayuda a afinar las recomendaciones. Todo es opcional.</p>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-body-sm text-tertiary">Nombre</span>
        <Input
          data-testid="nombre_input"
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="¿Cómo te llamas?"
        />
      </label>

      {/* FRESCO-1227: with Pro, the goal and the level lean the menu (never exclude a recipe); Free keeps the same
          menu, and two goals have no data behind them yet, so each option says what it does. */}
      <div className="mt-4 flex flex-col gap-1">
        <span className="text-body-sm text-tertiary">Objetivo</span>
        <p data-testid="objetivo_effect_hint" className="text-caption text-tertiary">
          Con Pro, tu objetivo inclina el menú hacia lo que buscas. Nunca deja recetas fuera.
        </p>
        <OptionCardGroup
          data-testid="objetivo_group"
          aria-label="Objetivo"
          options={OBJETIVO_OPTIONS}
          value={objetivo}
          onChange={value => setObjetivo(value)}
        />
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <span className="text-body-sm text-tertiary">Nivel de experiencia culinaria</span>
        <p data-testid="nivel_effect_hint" className="text-caption text-tertiary">
          Con Pro, si eres aprendiz o novato, el menú prefiere las recetas menos difíciles.
        </p>
        <OptionCardGroup
          data-testid="nivel_experiencia_group"
          aria-label="Nivel de experiencia culinaria"
          columns={1}
          options={NIVEL_EXPERIENCIA_OPTIONS}
          value={nivelExperiencia}
          onChange={value => setNivelExperiencia(value)}
        />
      </div>
    </>
  );
}
