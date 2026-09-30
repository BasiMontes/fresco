'use client';

import type * as React from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { ALERGENO_OPTIONS, INGREDIENTE_ODIADO_OPTIONS } from '@/lib/constants/dietary-options';
import { COCINA_OPTIONS, describePlanning, DIETA_OPTIONS, NIVEL_EXPERIENCIA_OPTIONS, OBJETIVO_OPTIONS, SEXO_OPTIONS } from '@/lib/onboarding/wizard-options';
import { useOnboardingStore } from '@/lib/store/onboarding-store';

export interface OnboardingSummaryProps {
  headingRef: React.RefObject<HTMLHeadingElement | null>
}

interface SummarySectionProps {
  id: 'profile' | 'diet' | 'household'
  title: string
  onEdit: () => void
  children: React.ReactNode
}

interface SummaryRowProps {
  label: string
  testId?: string
  children: React.ReactNode
}

interface ChipListProps {
  labels: string[]
  emptyLabel: string
  variant?: 'neutral' | 'allergen'
}

function labelOf<T extends string>(options: { value: T, label: string }[], value: T | null): string | null {
  return options.find(option => option.value === value)?.label ?? null;
}

function labelsOf<T extends string>(options: { value: T, label: string }[], values: T[]): string[] {
  return options.filter(option => values.includes(option.value)).map(option => option.label);
}

function withFreeText(labels: string[], text: string): string[] {
  const trimmed = text.trim();
  return trimmed ? [...labels, trimmed] : labels;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function Empty({ label = 'Sin indicar' }: { label?: string }) {
  return <span className="text-tertiary">{label}</span>;
}

function SummarySection({ id, title, onEdit, children }: SummarySectionProps) {
  return (
    <section data-testid={`summary_section_${id}`} className="mt-6 border-t border-border pt-4 first:mt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h5">{title}</h2>
        <Button
          type="button"
          variant="icon"
          data-testid={`summary_edit_${id}`}
          aria-label={`Editar ${title.toLowerCase()}`}
          onClick={onEdit}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <dl>{children}</dl>
    </section>
  );
}

function SummaryRow({ label, testId, children }: SummaryRowProps) {
  return (
    <div data-testid={testId} className="mt-3">
      <dt className="text-body-sm text-tertiary">{label}</dt>
      <dd className="mt-1 text-body-sm text-text">{children}</dd>
    </div>
  );
}

function ChipList({ labels, emptyLabel, variant = 'neutral' }: ChipListProps) {
  if (labels.length === 0) {
    return <Empty label={emptyLabel} />;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {labels.map(label => (
        <li key={label}>
          <Tag variant={variant}>{label}</Tag>
        </li>
      ))}
    </ul>
  );
}

/**
 * FRESCO-755 — read-only recap shown after the 3 data steps, before the menu
 * is generated. Each block carries an edit icon that sends the person back to
 * its step (`editFromSummary`), which returns here once confirmed. Allergens
 * are always rendered expanded, with the food-safety `allergen` tag, because
 * they condition what the generated menu may contain.
 */
export function OnboardingSummary({ headingRef }: OnboardingSummaryProps) {
  const {
    nombre,
    sexo,
    objetivo,
    nivelExperiencia,
    dietaVegetariano,
    dietaVegano,
    dietaSinGluten,
    dietaSinLactosa,
    dietaSinHuevo,
    dietaKeto,
    dietaHalal,
    alergenos,
    ingredientesOdiados,
    cocinasFavoritas,
    dietaTextoLibre,
    ingredientesOdiadosTextoLibre,
    cocinasTextoLibre,
    adultos,
    ninos,
    presupuestoSemanaEuros,
    planningSelection,
    editFromSummary,
  } = useOnboardingStore();

  const dietaState = { dietaVegetariano, dietaVegano, dietaSinGluten, dietaSinLactosa, dietaSinHuevo, dietaKeto, dietaHalal };
  const dietaLabels = withFreeText(
    DIETA_OPTIONS.filter(option => dietaState[option.value]).map(option => option.label),
    dietaTextoLibre,
  );
  const planning = describePlanning(planningSelection);

  return (
    <div data-testid="onboarding_summary">
      <h1 ref={headingRef} tabIndex={-1} className="text-h3 outline-hidden">Revisa tu resumen</h1>
      <p className="mt-1 text-body-sm text-tertiary">Comprueba que todo está bien antes de generar tu menú.</p>

      <SummarySection id="profile" title="Sobre ti" onEdit={() => editFromSummary(1)}>
        <SummaryRow label="Nombre">{nombre.trim() || <Empty />}</SummaryRow>
        <SummaryRow label="Sexo">{labelOf(SEXO_OPTIONS, sexo) ?? <Empty />}</SummaryRow>
        <SummaryRow label="Objetivo">{labelOf(OBJETIVO_OPTIONS, objetivo) ?? <Empty />}</SummaryRow>
        <SummaryRow label="Nivel de experiencia culinaria">{labelOf(NIVEL_EXPERIENCIA_OPTIONS, nivelExperiencia) ?? <Empty />}</SummaryRow>
      </SummarySection>

      <SummarySection id="diet" title="Alimentación" onEdit={() => editFromSummary(2)}>
        <SummaryRow label="Dieta y restricciones">
          <ChipList labels={dietaLabels} emptyLabel="Sin restricciones" />
        </SummaryRow>
        <SummaryRow label="Alérgenos a evitar" testId="summary_allergens">
          <ChipList
            labels={labelsOf(ALERGENO_OPTIONS, alergenos)}
            emptyLabel="Ninguno indicado"
            variant="allergen"
          />
        </SummaryRow>
        <SummaryRow label="Ingredientes que no te gustan">
          <ChipList
            labels={withFreeText(labelsOf(INGREDIENTE_ODIADO_OPTIONS, ingredientesOdiados), ingredientesOdiadosTextoLibre)}
            emptyLabel="Ninguno indicado"
          />
        </SummaryRow>
        <SummaryRow label="Cocinas favoritas">
          <ChipList
            labels={withFreeText(labelsOf(COCINA_OPTIONS, cocinasFavoritas), cocinasTextoLibre)}
            emptyLabel="Ninguna indicada"
          />
        </SummaryRow>
      </SummarySection>

      <SummarySection id="household" title="Tu hogar" onEdit={() => editFromSummary(3)}>
        <SummaryRow label="Quiénes cocináis">
          {`${plural(adultos, 'adulto', 'adultos')} · ${plural(ninos, 'niño', 'niños')}`}
        </SummaryRow>
        <SummaryRow label="Presupuesto semanal">
          {presupuestoSemanaEuros === null ? <Empty /> : `${presupuestoSemanaEuros} €`}
        </SummaryRow>
        <SummaryRow label="Días a planificar">{planning.days || <Empty />}</SummaryRow>
        <SummaryRow label="Comidas a planificar">{planning.meals || <Empty />}</SummaryRow>
      </SummarySection>
    </div>
  );
}
