import { Plus } from 'lucide-react';

/**
 * FRESCO-1044 (WCAG 1.2.3): the video's messages are burned into the picture and it has no voice, so someone who
 * cannot see it gets nothing. This is the text alternative, in the order the scenes appear. The headlines are the
 * ones on screen, word for word: if the video is re-cut, this list has to follow it.
 */
const TRANSCRIPT_SCENES = [
  'Se ve el logotipo de Fresco y el titular «Deja de improvisar en el súper.».',
  'Una tarjeta del alta, paso 1 de 3 (dieta), con «Vegetariano» elegido.',
  'Paso 3 de 3, «Planifica tu semana»: las preferencias elegidas (vegetariano, frutos de cáscara, cilantro y cocina española) y una rejilla de lunes a domingo con desayuno, almuerzo y cena marcados.',
  'El titular «Tu semana, lista.» y debajo el menú de la semana: una tarjeta por comida, con foto, día, tipo de comida y nombre de la receta.',
  'El titular «Tu lista, ya hecha.» y la lista de la compra ordenada por secciones (frutas y verduras, carnicería y pescadería, huevos y lácteos, panadería y despensa), con el total estimado del menú de la semana.',
  'El titular «Aprende de lo que realmente cocinas.» con el logotipo de Fresco.',
] as const;

/**
 * FRESCO-761 — brand video between the pain points and "Cómo funciona".
 *
 * `preload="none"` + `poster`: the 7 MB file is not requested until the user
 * presses play, so the landing's initial weight is unchanged. No `autoPlay`,
 * so it never starts with sound. The video has music only (no speech).
 *
 * FRESCO-1013 (A7-UI-17): a keyboard user must see where focus is (WCAG 2.4.7), and the video carries a Spanish
 * captions track (WCAG 1.2.2) whose one cue is "[Música instrumental]". If a voice-over is ever added,
 * `fresco-brand.es.vtt` has to carry what it says.
 *
 * FRESCO-1043: the track is available but NOT `default`. The video has no speech, so showing the cue over the
 * picture from the first second only got in the way, and the native player hides the off switch inside its
 * overflow menu. A viewer who wants captions turns them on there.
 *
 * FRESCO-1044: a native `<details>` under the video holds the transcription. It is closed on load, so it adds
 * no layout shift, works without JavaScript and is operable from the keyboard.
 */
export function BrandVideo() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
      <video
        className="aspect-video w-full rounded-md border border-border bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        controls
        playsInline
        preload="none"
        poster="/video/fresco-brand-poster.jpg"
        aria-label="Vídeo de presentación de Fresco"
      >
        <source src="/video/fresco-brand.mp4" type="video/mp4" />
        <track kind="captions" src="/video/fresco-brand.es.vtt" srcLang="es" label="Español" />
      </video>
      <details className="group mt-4 border-b border-border">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-4 rounded-sm py-2 text-label text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          Transcripción del vídeo
          <Plus
            className="size-5 shrink-0 text-neutral-500 transition-transform group-open:rotate-45 group-open:text-primary"
            aria-hidden="true"
          />
        </summary>
        <div className="pb-4 text-body-sm text-tertiary">
          <p>El vídeo dura 21 segundos, no tiene voz y lleva música instrumental. Esto es lo que muestra, en orden:</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {TRANSCRIPT_SCENES.map(scene => (
              <li key={scene}>{scene}</li>
            ))}
          </ol>
        </div>
      </details>
    </section>
  );
}
