/**
 * FRESCO-761 — brand video between the pain points and "Cómo funciona".
 *
 * `preload="none"` + `poster`: the 7 MB file is not requested until the user
 * presses play, so the landing's initial weight is unchanged. No `autoPlay`,
 * so it never starts with sound. The video has music only (no speech).
 *
 * FRESCO-1013 (A7-UI-17): a keyboard user must see where focus is (WCAG 2.4.7), and the video carries a Spanish
 * captions track (WCAG 1.2.2) that says so: its one cue is "[Música instrumental]". If a voice-over is ever
 * added, `fresco-brand.es.vtt` has to carry what it says.
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
        <track kind="captions" src="/video/fresco-brand.es.vtt" srcLang="es" label="Español" default />
      </video>
    </section>
  );
}
