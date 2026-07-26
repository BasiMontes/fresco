'use client';

import type { DietaBase } from '@/lib/store/onboarding-store';
import { useRouter } from 'next/navigation';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/tag';
import { generateMealPlan } from '@/lib/api/edge-functions';
import { useOnboardingStore } from '@/lib/store/onboarding-store';

/**
 * `/onboarding` — EPIC-FRESCO-1 (US 1.1/1.2: 3-step onboarding, kept short
 * so a guest doesn't abandon before reaching any value — user-journeys.md
 * Journey 1, Step 2). Single route driving all 3 steps internally (judgment
 * call, see report) rather than 3 separate routes.
 */

const DIETA_OPTIONS: { value: DietaBase, label: string }[] = [
  { value: 'omnivoro', label: 'Omnívoro' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'sin_gluten', label: 'Sin gluten' },
  { value: 'sin_lactosa', label: 'Sin lactosa' },
];

const COCINA_OPTIONS = ['Mediterránea', 'Italiana', 'Mexicana', 'Asiática', 'Española', 'India'];

export default function OnboardingPage() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const { step, dieta, cocinasFavoritas, numPersonas, setStep, toggleDieta, toggleCocina, setNumPersonas }
    = useOnboardingStore();

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const fechaInicio = new Date().toISOString().slice(0, 10);
      // TODO: guest-mode auth unresolved, see business-api-map.md
      // A guest at this point in the journey has no Supabase session yet
      // (user-journeys.md Journey 1: signup happens AFTER seeing the menu,
      // not before). Passing `null` here will 401 against a real deployment
      // until the guest-auth mechanism is decided.
      await generateMealPlan({ semana_iso: fechaInicio, fecha_inicio: fechaInicio }, null);
      router.push('/menu');
    }
    finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
      <p className="text-caption uppercase text-tertiary">
        Paso
        {step}
        {' '}
        de 3
      </p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-surface'}`} />
        ))}
      </div>

      <Card className="mt-6">
        {step === 1 && (
          <>
            <h1 className="text-h3">¿Qué dieta sigue tu hogar?</h1>
            <p className="mt-1 text-body-sm text-tertiary">Puedes elegir varias.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {DIETA_OPTIONS.map(option => (
                <button key={option.value} type="button" onClick={() => toggleDieta(option.value)}>
                  <Tag variant={dieta.includes(option.value) ? 'selected' : 'outline'}>
                    {option.label}
                  </Tag>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-h3">¿Cuáles son tus cocinas favoritas?</h1>
            <p className="mt-1 text-body-sm text-tertiary">Puedes elegir varias.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {COCINA_OPTIONS.map(cocina => (
                <button key={cocina} type="button" onClick={() => toggleCocina(cocina)}>
                  <Tag variant={cocinasFavoritas.includes(cocina) ? 'selected' : 'outline'}>
                    {cocina}
                  </Tag>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-h3">¿Cuántas personas cocináis en casa?</h1>
            <p className="mt-1 text-body-sm text-tertiary">Ajustaremos las cantidades del menú.</p>
            <Input
              type="number"
              min={1}
              max={10}
              value={numPersonas}
              onChange={e => setNumPersonas(Number(e.target.value))}
              className="mt-4 max-w-24"
            />
          </>
        )}

        <div className="mt-6 flex justify-between">
          <Button
            variant="secondary"
            onClick={() => setStep((step > 1 ? step - 1 : 1) as 1 | 2 | 3)}
            disabled={step === 1}
          >
            Atrás
          </Button>
          {step < 3
            ? (
                <Button onClick={() => setStep((step + 1) as 1 | 2 | 3)}>Siguiente</Button>
              )
            : (
                <Button
                  variant="action"
                  onClick={() => {
                    void handleGenerate();
                  }}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Generando menú…' : 'Generar mi menú'}
                </Button>
              )}
        </div>
      </Card>
    </div>
  );
}
