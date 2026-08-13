'use client';

import { ChevronRight, FileText, HelpCircle, Settings, Shield } from 'lucide-react';
import { useState } from 'react';
import { LegalModal } from '@/components/legal/legal-modal';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';

interface FaqItem {
  question: string
  answer: string
}

/**
 * Grounded in this session's own reading of the relevant code — no invented
 * features:
 * - Menu generation: `.context/ADR/ADR-0005-deterministic-menu-slot-selection.md`
 *   plus a follow-up commit (`ae3b560`, 2026-08-01) — a deterministic
 *   algorithm fills all 21 slots AND writes the learning-explanation text
 *   (Pro-tier). Gemini was fully removed from production; there is no LLM
 *   call anywhere in this path (FRESCO-121, QA sweep 2026-08-08 confirmed
 *   this FAQ item still claimed otherwise).
 * - Free vs. Pro: the exact sentence already shown in this page's own
 *   Pro-upsell `Card` below, quoted verbatim so this never contradicts it.
 * - Data deletion: the real, working `DangerZone` actions on this same page
 *   (`/api/profile/export`, `DeleteAccountDialog`).
 * - Allergen filtering: `get_filtered_recipes()`
 *   (`supabase/migrations/20260725120100_create_fresco_core_tables.sql`) —
 *   `not (coalesce(r.alergenos, '[]'::jsonb) ?| v_profile.alergenos)` excludes
 *   matching recipes structurally, at the SQL layer, before any menu is built.
 */
const FAQ_ITEMS: FaqItem[] = [
  {
    question: '¿Cómo genera Fresco mi menú semanal?',
    answer: 'Un algoritmo determinista rellena las 21 franjas de la semana combinando tu dieta, tus alergias y —si tienes Plan Pro— tu historial de calendario reciente. No es una IA la que elige receta a receta, ni la que redacta la explicación: todo el proceso es determinista, sin llamadas a ningún modelo de IA.',
  },
  {
    question: '¿Cómo cambio mis preferencias de dieta o alérgenos?',
    answer: 'Edítalas cuando quieras en la tarjeta "Preferencias", justo arriba en esta misma página.',
  },
  {
    question: '¿Qué diferencia hay entre Plan Free y Plan Pro?',
    answer: 'En Free, cada menú se genera solo a partir de tu dieta y tus alergias. Con Pro, además, cada menú aprende de lo que cocinas y descartas la semana anterior — cuanto más lo uses, menos tienes que pensar.',
  },
  {
    question: '¿Puedo borrar mis datos?',
    answer: 'Sí. En la sección "Zona de peligro", al final de esta página, puedes descargar un backup en CSV de todos tus datos o borrar tu cuenta de forma definitiva.',
  },
  {
    question: '¿Fresco filtra automáticamente mis alergias?',
    answer: 'Sí, de forma estructural: las recetas que contienen alguno de tus alérgenos declarados se excluyen directamente en la base de datos antes de que se genere el menú — no depende de que una IA "recuerde" evitarlas.',
  },
];

export interface AyudaSectionProps {
  /** Real logged-in email, header's own `'Invitada'` fallback for consistency. */
  email: string
  /** Already-resolved plan label (`PLAN_LABELS[plan]`) — no refetch here. */
  planLabel: string
  /** `user.created_at`, pre-formatted as a readable Spanish date, or `null` if unavailable. */
  memberSince: string | null
}

type AyudaModal = 'configuracion' | 'faq' | 'privacidad' | 'terminos' | null;

const ROWS = [
  { key: 'configuracion' as const, icon: Settings, label: 'Configuración' },
  { key: 'faq' as const, icon: HelpCircle, label: 'FAQ' },
  { key: 'privacidad' as const, icon: Shield, label: 'Privacidad' },
  // FRESCO-162 — the content already existed in LegalModal (TERMS_SECTIONS),
  // just had no entry point from `/profile`.
  { key: 'terminos' as const, icon: FileText, label: 'Términos de Servicio' },
];

/**
 * `/profile` Ayuda section — replaces the previous inert "Próximamente" rows
 * with 3 real modals. `Configuración` and `FAQ` follow `LegalModal`'s exact
 * pattern (same `Dialog` primitive, same title + sectioned-body structure)
 * for consistency with how `Privacidad` already opens elsewhere in this app;
 * `Privacidad` itself reuses `LegalModal` unmodified rather than duplicating
 * its already-real privacy copy.
 */
export function AyudaSection({ email, planLabel, memberSince }: AyudaSectionProps) {
  const [openModal, setOpenModal] = useState<AyudaModal>(null);
  // FRESCO-161 — reuses the same `resetPasswordForEmail` call and
  // anti-enumeration posture (no error branching — Supabase's own API never
  // reveals whether the address has an account either) as
  // `app/forgot-password/page.tsx`'s step 1, rather than building a
  // current-password-verification form from scratch.
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState(false);

  async function handleSendPasswordReset() {
    setIsSendingReset(true);
    setResetError(false);
    try {
      const client = createClient();
      const { error } = await client.auth.resetPasswordForEmail(email);
      // FRESCO-167: a real API failure (rate-limit, network, 5xx) must not
      // be silenced as success — only "email doesn't exist" stays hidden,
      // per the anti-enumeration posture this flow shares with
      // forgot-password/page.tsx. `error` here is a real API error, never
      // "unknown email" (Supabase doesn't distinguish that case in the
      // response either).
      if (error) {
        setResetError(true);
        return;
      }
      setResetSent(true);
    }
    finally {
      setIsSendingReset(false);
    }
  }

  return (
    <>
      <div className="flex flex-col divide-y divide-border">
        {ROWS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            data-testid={`ayuda_row_${key}`}
            onClick={() => setOpenModal(key)}
            className="flex items-center justify-between gap-2 py-3 text-left text-text first:pt-0 last:pb-0 hover:text-primary"
          >
            <div className="flex items-center gap-2 text-body-md">
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </div>
            <ChevronRight className="size-4 text-tertiary" aria-hidden="true" />
          </button>
        ))}
      </div>

      <Dialog
        open={openModal === 'configuracion'}
        onOpenChange={open => setOpenModal(open ? 'configuracion' : null)}
        aria-label="Configuración"
        data-testid="settings_modal"
      >
        <h2 className="text-h4 pr-8">Configuración</h2>
        <div className="mt-4 flex flex-col gap-4 text-body-sm text-text">
          <div>
            <h3 className="text-label mb-1">Email</h3>
            <p className="text-tertiary">{email}</p>
          </div>
          <div>
            <h3 className="text-label mb-1">Plan actual</h3>
            <p className="text-tertiary">{planLabel}</p>
          </div>
          {memberSince && (
            <div>
              <h3 className="text-label mb-1">Miembro desde</h3>
              <p className="text-tertiary">{memberSince}</p>
            </div>
          )}
          <div>
            <h3 className="text-label mb-1">Contraseña</h3>
            {resetSent
              ? (
                  <p data-testid="password_reset_sent_message" role="status" aria-live="polite" className="text-tertiary">
                    Te enviamos un enlace a
                    {' '}
                    {email}
                    {' '}
                    para elegir una nueva contraseña.
                  </p>
                )
              : (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid="cambiar_contrasena_button"
                      disabled={isSendingReset}
                      onClick={() => void handleSendPasswordReset()}
                    >
                      {isSendingReset ? 'Enviando…' : 'Cambiar contraseña'}
                    </Button>
                    {resetError && (
                      <p data-testid="password_reset_error_message" role="alert" aria-live="assertive" className="mt-2 text-body-sm text-error">
                        No pudimos enviar el enlace. Inténtalo de nuevo.
                      </p>
                    )}
                  </>
                )}
          </div>
          <p className="text-caption text-tertiary">
            ¿Quieres cambiar tu dieta o alérgenos? Edítalos en la tarjeta "Preferencias" de arriba.
          </p>
        </div>
      </Dialog>

      <Dialog
        open={openModal === 'faq'}
        onOpenChange={open => setOpenModal(open ? 'faq' : null)}
        aria-label="Preguntas frecuentes"
        data-testid="faq_modal"
        className="sm:max-w-2xl"
      >
        <h2 className="text-h4 pr-8">Preguntas frecuentes</h2>
        {/* FRESCO-162 — bumped from text-body-sm/text-tertiary (13px, muted)
            to text-body-md/text-text (15px, full-contrast): this is the
            primary content being read, not secondary metadata. */}
        <div className="mt-4 flex flex-col gap-4 text-body-md text-text">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <div key={question}>
              <h3 className="text-label mb-1">{question}</h3>
              <p>{answer}</p>
            </div>
          ))}
        </div>
      </Dialog>

      <LegalModal
        open={openModal === 'terminos'}
        onOpenChange={open => setOpenModal(open ? 'terminos' : null)}
        section="terminos"
      />

      <LegalModal
        open={openModal === 'privacidad'}
        onOpenChange={open => setOpenModal(open ? 'privacidad' : null)}
        section="privacidad"
      />
    </>
  );
}
