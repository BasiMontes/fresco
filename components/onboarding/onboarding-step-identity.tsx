'use client';

import type { NivelExperienciaCulinaria, ObjetivoUsuario, SexoUsuario } from '@schemas';
import type * as React from 'react';
import { Dropdown } from '@/components/ui/dropdown';
import { Input } from '@/components/ui/input';
import { NIVEL_EXPERIENCIA_OPTIONS, OBJETIVO_OPTIONS, SEXO_OPTIONS } from '@/lib/onboarding/wizard-options';
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
  const { nombre, sexo, objetivo, nivelExperiencia, setNombre, setSexo, setObjetivo, setNivelExperiencia } = useOnboardingStore();

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="text-h3 outline-none">Cuéntanos sobre ti</h1>
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

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-body-sm text-tertiary">Sexo</span>
        <Dropdown
          data-testid="sexo_dropdown"
          aria-label="Sexo"
          options={SEXO_OPTIONS}
          value={sexo}
          onChange={value => setSexo(value as SexoUsuario)}
          placeholder="Selecciona una opción"
        />
      </label>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-body-sm text-tertiary">Objetivo</span>
        <Dropdown
          data-testid="objetivo_dropdown"
          aria-label="Objetivo"
          options={OBJETIVO_OPTIONS}
          value={objetivo}
          onChange={value => setObjetivo(value as ObjetivoUsuario)}
          placeholder="¿Qué buscas conseguir?"
        />
      </label>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-body-sm text-tertiary">Nivel de experiencia culinaria</span>
        <Dropdown
          data-testid="nivel_experiencia_dropdown"
          aria-label="Nivel de experiencia culinaria"
          options={NIVEL_EXPERIENCIA_OPTIONS}
          value={nivelExperiencia}
          onChange={value => setNivelExperiencia(value as NivelExperienciaCulinaria)}
          placeholder="¿Cuánto sabes cocinar?"
        />
      </label>
    </>
  );
}
