/**
 * FRESCO-733 (A5-H3): `triggerLikeBurst` + its helpers, previously
 * identical copies in `favorite-toggle-button.tsx` and `recipe-card.tsx`
 * (originally kept local per FRESCO-248 since neither file shared a parent
 * to lift a hook into — a plain module import doesn't need one).
 */

export const LIKE_PARTICLE_COUNT = 8;

/**
 * FRESCO-248 — reads a CSS `<time>` custom property as milliseconds.
 * `getComputedStyle` does NOT reliably keep the `ms` unit: Chromium
 * serializes some values as `s` (empirically confirmed live —
 * `--like-particle-dur: 600ms` computes to `".6s"`, not `"600ms"`). A plain
 * `parseFloat` on that string silently reads `0.6` and fires the cleanup
 * timer ~20ms later instead of 600ms — caught by sampling the DOM during
 * live verification, not by code-reading alone.
 */
function readCssTimeMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return raw.endsWith('ms') ? value : value * 1000;
}

/**
 * FRESCO-248 — seeds each of the 8 particles' fling vector (45° increments)
 * and replays the `.is-bursting` class for the CSS-driven burst
 * (`transitions-dev`'s `23-like-button.md`, `t-like-particles`). Only
 * called on a `false -> true` (liking) transition — unliking reverses the
 * fill without a burst, per the snippet's own documented behavior.
 */
export function triggerLikeBurst(button: HTMLButtonElement | null) {
  if (!button) {
    return;
  }
  const particles = button.querySelectorAll<HTMLElement>('.t-like-particles i');
  particles.forEach((particle, index) => {
    const angle = (360 / LIKE_PARTICLE_COUNT) * index;
    const radians = (angle * Math.PI) / 180;
    particle.style.setProperty('--px', `${Math.cos(radians) * 20}px`);
    particle.style.setProperty('--py', `${Math.sin(radians) * 20}px`);
    particle.style.setProperty('--pdelay', `${index * 15}ms`);
  });

  button.classList.remove('is-bursting');
  // FRESCO-721 — double rAF instead of a synchronous `offsetWidth` read: by
  // the second frame the class removal above has already been applied, so
  // re-adding it reliably replays the animation without forcing a
  // synchronous layout recalculation.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      button.classList.add('is-bursting');
      const burstDur = readCssTimeMs('--like-particle-dur', 600);
      window.setTimeout(() => button.classList.remove('is-bursting'), burstDur + 20);
    });
  });
}
