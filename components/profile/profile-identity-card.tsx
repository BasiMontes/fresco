import type { UserProfile } from '@schemas';
import { User as UserIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import { getPlanTagVariant, PLAN_LABELS } from '@/lib/plan-labels';

interface ProfileIdentityCardProps {
  nombre: string | null
  email: string | undefined
  isAnonymous: boolean
  plan: UserProfile['plan']
}

export function ProfileIdentityCard({ nombre, email, isAnonymous, plan }: ProfileIdentityCardProps) {
  const initial = nombre?.trim().charAt(0).toUpperCase();

  return (
    <>
      <h2 className="sr-only">Tu cuenta</h2>
      <Card className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-h5 text-on-brand"
            >
              {initial || <UserIcon className="size-6" />}
            </div>
            <div className="min-w-0">
              {/* FRESCO-451 (slice 5/5): the no-name case read as a bare,
                  unfinished "Hola" — matches /menu's "¡Hola!" / "¡Hola,
                  {nombre}!" pattern instead. */}
              <p className="truncate text-h5">
                {nombre ? `¡Hola, ${nombre}!` : '¡Hola!'}
              </p>
              {/* FRESCO-218: reflect the onboarding identity choice
                  (FRESCO-197) here — a guest sees a plain "Invitada" badge
                  (no email exists to show), an upgraded/registered user sees
                  her real email plus a masked password row. The dots are a
                  fixed placeholder, never the real password — Supabase never
                  exposes it, hashed or otherwise; this is purely a visual
                  confirmation that credentials are set. */}
              {isAnonymous
                ? (
                    <Tag data-testid="profile_identity_guest_tag" variant="neutral" className="mt-1">
                      Invitada
                    </Tag>
                  )
                : (
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      <p data-testid="profile_identity_email" className="truncate text-body-sm text-tertiary">{email}</p>
                      <p data-testid="profile_identity_password_masked" className="text-body-sm tracking-widest text-tertiary">••••••••</p>
                    </div>
                  )}
            </div>
          </div>
          <Tag variant={getPlanTagVariant(plan)} className="shrink-0">{PLAN_LABELS[plan]}</Tag>
        </div>
      </Card>
    </>
  );
}
