interface OnboardingGenerateStatusProps {
  step: number
  generateError: string | null
  generateSuccess: boolean
  isGenerating: boolean
  hasExistingMenu: boolean
}

/** Error / existing-menu / success / progress messages shown under the summary step. */
export function OnboardingGenerateStatus({ step, generateError, generateSuccess, isGenerating, hasExistingMenu }: OnboardingGenerateStatusProps) {
  return (
    <>
      {step === 4 && generateError && !hasExistingMenu && (
        <div className="mt-4">
          <p data-testid="generate_error_message" role="alert" aria-live="assertive" className="text-body-sm text-error">
            {generateError}
          </p>
        </div>
      )}

      {/* FRESCO-152: when a plan already exists, the error text stays
      informational but the *action* moves into the primary CTA below
      ("Ver mi menú", de-emphasized) instead of also living here as a
      separate link — one action, not two competing ones. */}
      {step === 4 && hasExistingMenu && (
        <p data-testid="generate_error_message" role="status" aria-live="polite" className="mt-4 text-body-sm text-tertiary">
          {generateError}
        </p>
      )}

      {generateSuccess
        ? (
            <p data-testid="generate_success_message" role="status" aria-live="polite" className="mt-4 text-body-sm text-primary">
              Se ha generado tu menú correctamente. Te llevamos a verlo…
            </p>
          )
        : isGenerating && (
          // ADR-0005: menu-slot selection is now a deterministic algorithm
          // (~2-3s observed live), not a per-call Gemini generation — the
          // old "puede tardar hasta un minuto" copy overstated the real
          // wait once that shipped. Kept the spinner + hint pattern itself
          // (still reassuring during any wait, however short), just
          // corrected what it claims.
          <p data-testid="generating_hint" role="status" aria-live="polite" className="mt-4 text-body-sm text-tertiary">
            Preparando tu menú…
          </p>
        )}
    </>
  );
}
