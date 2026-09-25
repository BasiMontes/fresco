# Hyperframes Composition Brief: Fresco

## Objective
Create a short launch-style brag video for Fresco, a weekly meal-planning app for Spanish households.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds (15-25s range)

## Source Material
- Project root: `/Users/basimontes/fresco/fresco-app`
- Primary files read: `app/page.tsx`, `components/landing/hero.tsx`, `components/landing/how-it-works.tsx`, `components/landing/learns-pro.tsx`, `app/onboarding/page.tsx`, `components/calendar/calendar-grid.tsx`, `DESIGN.md`, `README.md`
- Product name: Fresco
- Tagline / strongest claim: "Fresco genera tu menú semanal y tu lista de compra en 30 segundos, y acierta más cada semana porque aprende de lo que realmente cocinas."
- Key UI or visual moment to recreate: the 3-step onboarding wizard collapsing into a populated 7-day / 21-meal calendar grid, then the aisle-grouped shopping list
- Copy that must appear verbatim:
  - "Deja de improvisar en el súper."
  - "Paso 1 de 3" / "Paso 2 de 3" / "Paso 3 de 3"
  - "Generando menú…"
  - "Aprende de lo que realmente cocinas."

## Creative Direction
- Tone preset: polished
- Creative direction: quiet, confident Sunday-planning relief — an editorial food-brand film, not a startup pitch
- Interpretation: fewer, longer-held scenes; soft crossfades over hard cuts; every line gets its full reading floor before it moves; restraint over speed
- Angle: the video earns its claim by showing the actual 3-question → finished-week arc, not by stating it. The one differentiator worth landing is "learns from what you actually cook, not what you say you like" — implied visually by the calendar/shopping-list payoff, stated only in the outro line.
- Hook: cream field, Fraunces "Deja de improvisar en el súper." (súper. in deep green)
- Outro / punchline: cream field, Fraunces "Aprende de lo que realmente cocinas." + logo settle, no CTA
- Avoid:
  - Generic SaaS language ("streamline," "workflow," etc. — none of this app's real copy uses it, don't introduce it)
  - Abstract filler visuals (no stock icon soup, no generic dashboard mockup)
  - Unrelated visual redesign — use the real token values below, not a reinterpreted palette

## Visual Identity
- Background: `#FAF3E3` (warm cream)
- Card / surface-raised: `#FBF6EC`, hairline border `color-mix(in srgb, #201E1D 16%, transparent)`
- Text: `#201E1D`
- Primary accent (deep green): `#0F4E0E`
- Secondary accent (burnt orange, use sparingly — one-accent discipline): `#DF8C26`
- Display font: Fraunces (headlines only — the two verbatim lines above)
- Body font: Figtree (UI chrome — step labels, chip text, card labels)
- Visual references from the project: `HERO_PHOTOS` in `components/landing/hero.tsx` for warm, editorial dish-photography mood (real Unsplash food photography, not illustration); the wizard step-indicator dot pattern in `app/onboarding/page.tsx`; the calendar's day-column / meal-card shape in `components/calendar/calendar-grid.tsx`

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 3s — "Deja de improvisar en el súper." settles and holds, readable
2. Onboarding — 4s — step-indicator dots 1→2→3 advance, 3 diet/cuisine chips select in sequence underneath
3. Generating → weekly calendar reveal — 7s — brief "Generando menú…" spinner, hard cut into 7-day / 21-card calendar grid staggering in by day column (centerpiece — longest hold)
4. Shopping list — 4s — aisle-header groups slide in with grouped ingredients, one checkbox ticks, totals line settles
5. Outro — 2s — "Aprende de lo que realmente cocinas." + logo hold

## Audio
- Audio role: warm, restrained instrumental bed with sparse professional accents
- Audio arc: bed enters under the hook, stays understated through onboarding, swells once at the calendar-grid reveal (scene 3, the emotional high point), settles through the shopping list, fades out under the outro hold
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (already copied into `brag-output/composition/assets/music/`) — 109.96 BPM, calmest tempo of the 5 bundled tracks, full 117s length gives headroom to pick the best 20s window rather than starting at 0:00 if a calmer intro passage exists further in
- Music treatment: fade in under scene 1, hold low/understated through scene 2, small swell starting into scene 3, settle down through scene 4, fade out under scene 5's hold
- Music cue guidance: preset at `brag-output/../.claude/skills/brag/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` (full) and `.music-cues.md` (compact, 0-25s window). Two suggested strong-cue locks:
  - Calendar-grid reveal (scene 3 start, ~7-8.7s in the current scene plan) → nearest strong cue at **8.74s** (0.99)
  - Outro logo settle (scene 5 start, ~18s in the current scene plan) → nearest strong cue at **18.56s** (0.99)
  Both are optional — shift scene boundaries by up to ~1s to land on these if it doesn't hurt scene 3's reading floor or scene 4's duration.
- Audio-reactive treatment: subtle only — at most a soft glow/presence on the calendar-grid reveal tied to RMS; never waveform bars, never strobing/pulsing
- Audio-coupled moments:
  - Scene 2 step-dots (3, non-text ticks) — may snap to every beat in the 3.27-6.56s window
  - Scene 2 chips (3, short text labels: "Vegetariano," "Sin gluten," "Española") — snap to every OTHER beat or hold the full floor (~0.8s settled each) so they stay readable; do not outrun the 109.96 BPM grid with 3 text reveals in under 2s
  - Scene 3 calendar cards — 7 day-column groups, one soft "arrive" sound per group, not per individual card (21 cards is too dense for per-card SFX)
  - Scene 4 aisle groups + one checkbox tick — grid available at 13.64-18.56s in the cue file
- SFX selection guidance: soft UI tick for step-dot fill and chip select, one soft "card arrive" per day-column group in scene 3, one soft chime on the shopping-list checkbox tick. No drops, no risers, no chaotic-tone energy — this is a calm product.
- SFX analysis guidance: read `<skill-dir>/assets/sfx/sfx-analysis.md` before selecting exact files; prefer low high-frequency-risk sounds since several of these moments repeat (7 card-arrive groups, 3-4 aisle groups)
- Exact SFX choice: Hyperframes chooses exact filenames, timestamps, density, and volume based on the implemented animation
- Audio files: music already copied to `brag-output/composition/assets/music/`; SFX gets copied into the same `assets/` tree once Hyperframes selects it

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli` — to create `brag-output/composition/`. This is `/brag`'s own workflow: do not enter the generic `hyperframes` intent interview or its promo/launch-video workflow.

Requirements:
- Show at least one real UI, copy, or visual element from the source project (the onboarding wizard, the calendar grid, and the shopping list all qualify — use at least the calendar grid, it's the centerpiece).
- Keep all text readable in the final render — respect the reading-time floor from `step-2-plan.md` (short label ~0.8s settled, sentence ~0.3s/word).
- Keep the video within 15-25 seconds (target 20s).
- Include the planned music/SFX layer.
- Treat the cue guidance above as optional hints, not a fixed cue sheet — ignore any cue that hurts readability or pacing.
- Run `hyperframes check` before render (the single gate).
