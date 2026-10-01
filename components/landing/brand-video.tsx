/**
 * FRESCO-761 — brand video between the pain points and "Cómo funciona".
 *
 * `preload="none"` + `poster`: the 7 MB file is not requested until the user
 * presses play, so the landing's initial weight is unchanged. No `autoPlay`,
 * so it never starts with sound. The video has music only (no speech), hence
 * no caption track.
 */
export function BrandVideo() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
      <video
        className="aspect-video w-full rounded-md border border-border bg-surface-raised"
        controls
        playsInline
        preload="none"
        poster="/video/fresco-brand-poster.jpg"
        aria-label="Vídeo de presentación de Fresco"
      >
        <source src="/video/fresco-brand.mp4" type="video/mp4" />
      </video>
    </section>
  );
}
