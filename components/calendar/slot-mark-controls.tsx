import type { LucideIcon } from 'lucide-react';
import type { DiaSemana, EstadoRecetaSlot, TipoPlato } from '@/lib/api/types';
import { ArrowLeftRight, Check, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Spoken forms of the day, with their accent, for the accessible names below. */
const DIA_HABLADO: Record<DiaSemana, string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  domingo: 'domingo',
};

/** The dish, the day and the meal: what tells twenty-one identical buttons apart (FRESCO-1013). */
function describeSlot({ dia, tipo, nombre }: { dia: DiaSemana, tipo: TipoPlato, nombre?: string | null }) {
  return `${nombre ? `${nombre}, ` : ''}${DIA_HABLADO[dia]}, ${tipo}`;
}

type Tone = 'neutral' | 'bad';

interface IconMarkButtonProps {
  testId: string
  /** The accessible name. It starts with `word`, so "pulsa Descartar" matches (WCAG 2.5.3 Label in Name). */
  label: string
  /** The word the icon stands for. Drawn inside the button but hidden from assistive technology. */
  word: string
  icon: LucideIcon
  tone: Tone
  disabled: boolean
  onPress: () => void
}

/**
 * FRESCO-1199: one mark button as an icon over the recipe photo. The button box is 44 x 44 (`h-11 min-w-11`)
 * because the e2e touch-target step measures the element itself; what the person sees is the 34 px circle
 * inside it with a 13 px glyph. On hover (`hover:` only fires on devices that can hover) and on keyboard
 * focus the circle opens into a pill with the word, so the icon never has to be guessed. A phone has no
 * hover, so there the icons stay as they are. The accessible name is the `aria-label`, never the word.
 */
function IconMarkButton({ testId, label, word, icon: Icon, tone, disabled, onPress }: IconMarkButtonProps) {
  const bad = tone === 'bad';
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onPress();
      }}
      className={cn(
        'group flex h-11 min-w-11 items-center justify-center rounded-full px-[5px] text-tertiary focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-65',
        bad ? 'hover:text-error focus-visible:text-error' : 'hover:text-primary focus-visible:text-primary',
      )}
    >
      <span
        className={cn(
          'inline-flex h-[34px] min-w-[34px] items-center justify-center rounded-full border border-neutral-600 bg-surface-raised transition-[background-color,padding] duration-(--duration-fast) ease-(--ease-smooth-out) motion-reduce:transition-none',
          'group-hover:px-2.5 group-focus-visible:px-2.5 group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-1',
          bad ? 'group-hover:bg-error/10 group-focus-visible:bg-error/10' : 'group-hover:bg-accent-100 group-focus-visible:bg-accent-100',
        )}
      >
        <Icon className="size-[13px] shrink-0" aria-hidden="true" />
        <span
          aria-hidden="true"
          className="max-w-0 overflow-hidden whitespace-nowrap text-caption font-semibold opacity-0 transition-[max-width,opacity,margin] duration-(--duration-fast) ease-(--ease-smooth-out) group-hover:ml-1.5 group-hover:max-w-16 group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:max-w-16 group-focus-visible:opacity-100 motion-reduce:transition-opacity"
        >
          {word}
        </span>
      </span>
    </button>
  );
}

/** Pins its buttons to the bottom-right of the recipe photo it is rendered in (`RecipeCardMedia`'s `overlay`). */
function OverlayRow({ children }: { children: React.ReactNode }) {
  return <div className="absolute bottom-1 right-1 flex gap-0.5">{children}</div>;
}

interface SlotMarkControlsProps {
  dia: DiaSemana
  tipo: TipoPlato
  /** The dish in this slot: the accessible name says which one is being marked (FRESCO-1013, A7-UI-05). */
  nombre?: string | null
  pending: boolean
  /** STORY-FRESCO-15 — marks this slot cocinada/descartada; no-ops if not pendiente. */
  onMark: (estado: 'cocinada' | 'descartada') => void
}

/**
 * FRESCO-373 (A4-M27) made these two full-width labelled buttons, 44 px tall (WCAG 2.5.5), because the
 * paid tier depends on this interaction. FRESCO-1199: they sat in the card body and took more height than
 * the recipe's own name and tags, repeated up to 21 times a week. They are now icon buttons over the photo
 * (the owner ratified the mockup on 2026-11-12) and the body keeps only the recipe.
 */
export function SlotMarkControls({ dia, tipo, nombre, pending, onMark }: SlotMarkControlsProps) {
  const donde = describeSlot({ dia, tipo, nombre });
  return (
    <OverlayRow>
      <IconMarkButton
        testId={`calendar_slot_${dia}_${tipo}_mark_cocinada`}
        label={`Cocinado: ${donde}`}
        word="Cocinado"
        icon={Check}
        tone="neutral"
        disabled={pending}
        onPress={() => onMark('cocinada')}
      />
      <IconMarkButton
        testId={`calendar_slot_${dia}_${tipo}_mark_descartada`}
        label={`Descartar: ${donde}`}
        word="Descartar"
        icon={X}
        tone="bad"
        disabled={pending}
        onPress={() => onMark('descartada')}
      />
    </OverlayRow>
  );
}

interface SlotEstadoBadgeProps {
  dia: DiaSemana
  tipo: TipoPlato
  estado: EstadoRecetaSlot
}

/**
 * Terminal-state chip over the top-right of the photo once a slot is not `pendiente` (FRESCO-1199: it used
 * to be a line in the card body). The drag handle sits at the top-left. The text stays exactly "Cocinado" or
 * "Descartado": the e2e steps read it.
 */
export function SlotEstadoBadge({ dia, tipo, estado }: SlotEstadoBadgeProps) {
  const cocinada = estado === 'cocinada';
  const Icon = cocinada ? Check : X;
  return (
    <span
      data-testid={`calendar_slot_${dia}_${tipo}_estado_badge`}
      className={cn(
        'absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-border bg-surface-raised px-2.5 py-1 text-caption font-semibold',
        cocinada ? 'text-primary' : 'text-tertiary',
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {cocinada ? 'Cocinado' : 'Descartado'}
    </span>
  );
}

interface SlotChangeMarkControlsProps {
  dia: DiaSemana
  tipo: TipoPlato
  /** The dish in this slot: the accessible names say which one is being changed. */
  nombre?: string | null
  /** The slot's current mark. */
  estado: 'cocinada' | 'descartada'
  pending: boolean
  onMark: (estado: 'cocinada' | 'descartada' | 'pendiente') => void
}

/**
 * FRESCO-1014 (A7-UI-15): a mark used to be permanent after a five-second snackbar, so one mis-tap on
 * "Descartar" banned a dish for two weeks with no way back. Inside the current week the mark can be taken
 * back or switched to the other one. FRESCO-1199: same icon buttons over the photo as `SlotMarkControls`; with
 * only an icon their name can no longer be their text, so each carries an `aria-label` that names the dish.
 */
export function SlotChangeMarkControls({ dia, tipo, nombre, estado, pending, onMark }: SlotChangeMarkControlsProps) {
  const other = estado === 'cocinada' ? 'descartada' : 'cocinada';
  const donde = describeSlot({ dia, tipo, nombre });
  return (
    <OverlayRow>
      <IconMarkButton
        testId={`calendar_slot_${dia}_${tipo}_unmark`}
        label={`Quitar marca: ${donde}`}
        word="Quitar"
        icon={Undo2}
        tone="neutral"
        disabled={pending}
        onPress={() => onMark('pendiente')}
      />
      <IconMarkButton
        testId={`calendar_slot_${dia}_${tipo}_switch`}
        label={`Cambiar a ${other === 'cocinada' ? 'cocinado' : 'descartado'}: ${donde}`}
        word="Cambiar"
        icon={ArrowLeftRight}
        tone={other === 'descartada' ? 'bad' : 'neutral'}
        disabled={pending}
        onPress={() => onMark(other)}
      />
    </OverlayRow>
  );
}
