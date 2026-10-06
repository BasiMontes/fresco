export function OnboardingStepIndicator({ step }: { step: number }) {
  return (
    <div className="t-stagger-line t-stagger-line--2 mt-6">
      <p data-testid="step_indicator_label" className="text-caption uppercase text-tertiary">
        {step === 4 ? 'Resumen' : `Paso ${step} de 3`}
      </p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-surface'}`} />
        ))}
      </div>
    </div>
  );
}
