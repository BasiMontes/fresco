# Hyperframes Composition Brief: Fresco — Problem / Solution cut

## Objective
Second brag video for Fresco. v1 (`brag-output/`) showed the product flow (onboarding → menu → shopping list). This cut carries the emotional case: the real pain, then the real relief, using the app's own shipped copy for both.

## Output
- Composition directory: `brag-output-2026-09-25-084635/composition/`
- Rendered video: `brag-output-2026-09-25-084635/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Primary files read: `components/landing/pain-points.tsx`, `components/landing/impact-stats.tsx`, `components/landing/hero.tsx`, `DESIGN.md`
- Copy that must appear verbatim:
  - "¿Cuántas veces has acabado comiendo lo que sea?"
  - "El domingo por la tarde." / "Mirando el techo intentando recordar qué había en la nevera."
  - "El súper sin lista." / "Sales con el doble de lo que necesitas y olvidas la mitad de lo que ibas a buscar."
  - "El miércoles a las 8pm." / "Nevera medio vacía, cansancio máximo y la pregunta de siempre: ¿qué hacemos de cenar?"
  - "En 30 segundos" / "Tu menú completo de lunes a domingo, sin pensar qué cocinar."
  - "Sin repetir" / "No vuelven las recetas de las últimas semanas."
  - "Lista ya hecha" / "La compra agrupada por pasillos del súper."
  - "Deja de improvisar en el súper."

## Creative Direction
- Tone preset: polished
- Angle: weight → turn → light. Dramatize the real pain-point section (already shipped as dark-green cards with red ✗ badges — reuse that exact treatment) for the first 9s, one hard cut into cream for the solution, close on the hero's own tagline as payoff instead of hook.
- Avoid: repeating v1's product-flow scenes (onboarding, calendar, shopping list) — this video's job is the emotional case, not the feature tour.

## Visual Identity
- Dark section bg: `#0F4E0E` (primary) — matches live `PainPoints` `bg-primary`
- Pain card: bg `#0A3E09` (accent-600), border `#052D05` (accent-700)
- Pain badge: bg `#B03D2B` (error), cream ✗ glyph
- Cream section bg: `#FAF3E3` (background)
- Solution card: bg `#F1E3C6` (surface), hairline border
- Solution icon chip: bg `#FCF1E8` (accent-2-100), icon tint `#8A5513` (accent-2-700)
- Display font: Fraunces · Body font: Figtree (same font files as v1, reuse — do not re-download)
- Logo: same `logo-base.svg` as v1 (reuse)

## Storyboard
Full storyboard and timing in `brag-plan.md`. Structural simplification for implementation: this composition uses TWO hard scene containers (not five) since most of the internal beats share the same background — a dark scene (hook + 3 pain cards, 0-9s) and a cream scene (turn + 3 solution cards + outro line, 9-20s), with ONE hard-cut transition at t=9s carrying all the dramatic weight. Internal beats within each scene get their own entrance/exit choreography (same pattern as v1's spinner→calendar handoff inside one scene).

## Audio
- Music: same track as v1, `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (reuse the file already in v1's composition — copy, don't re-download)
- Treatment: low/grounded under the dark section, a clear volume lift at the t=9s cut, warm through the cream section, fade out under the outro hold
- SFX: a heavier/duller thud per pain-card arrival (`impact/impactSoft_heavy_003.ogg`, low-medium HF risk, distinct from v1's brighter card sound), one bright accent on the turn (`impact/impactBell_heavy_000.ogg` — the skill's own "logo payoff/reveal confirmation" pick), a light sound per solution-card arrival (`impact/impactSoft_medium_001.ogg`)
- No audio-reactive treatment (kept simple, same call as v1)

## Hyperframes Instructions
Same domain skills as v1 (`hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-cli`). Reuse v1's proven patterns: waterfall-entry for headlines, spring-pop-entrance for staggered cards, medium blur-crossfade is NOT used at the t=9s cut (that boundary is a deliberate hard cut per the creative direction — the abruptness IS the point, dark-to-light with no dissolve). Run `hyperframes check` before render.
