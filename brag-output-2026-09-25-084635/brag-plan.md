# Brag Plan: Fresco — Problem / Solution cut

## What is this app?
Fresco generates a full weekly menu (21 meals) and an aisle-grouped shopping list for a Spanish household in under 30 seconds, and gets more accurate every week by learning from what people actually cook.

## The angle
This is the second brag video for the same product (v1 = `brag-output/`, showed the product flow: onboarding → menu → shopping list). This cut does NOT repeat that — its job is the emotional case, not the feature tour. It dramatizes the real pain (three specific, lived moments, verbatim from the shipped `PainPoints` section) and then pivots hard into relief, using the app's own three "what Fresco does for you" claims as the answer. Structurally: weight → turn → light.

## Hook (first 2-3 seconds)
The app's real pain-section H2, verbatim: "¿Cuántas veces has acabado comiendo lo que sea?" — dark green field (the exact `bg-primary` treatment the live pain-points section already uses), cream/white text.

## Key moments (the middle)
- Three real pain-point cards, sequential, verbatim copy and verbatim visual treatment (dark green card, red ✗ badge, bold lead line): "El domingo por la tarde" / "El súper sin lista" / "El miércoles a las 8pm."
- The turn: a brief bright cut to the Fresco wordmark on cream — the visual relief itself is the payoff, before any text explains it.
- Three real solution cards, together or in quick sequence, verbatim copy from `ImpactStats`: "En 30 segundos" / "Sin repetir" / "Lista ya hecha."

## Outro / punchline
"Deja de improvisar en el súper." (the real hero H1 line) as the closing line this time — v1 used it as the opening hook; here it lands as the payoff after the problem has been named. Fresco wordmark holds.

## User flow worth showing
None deliberately — this cut is copy/emotion-led, not flow-led. v1 already owns the flow demonstration (onboarding → calendar → shopping list). Repeating it here would dilute both videos.

## Tone
- Preset: `polished`
- Creative direction: same calm editorial register as v1, but built on contrast — the pain section is genuinely heavier (dark ground, blunt copy, red ✗ marks, already how the live product treats it) and the solution section is genuinely lighter (cream, green, quiet confidence). The tone preset doesn't change; the palette does the emotional work.
- Interpretation: no bouncy energy, no dramatic shader transitions — restraint stays even through the "weight" section. The contrast between dark and light passages carries the drama, not the motion style.

## Format: landscape — 1920x1080
## Duration: 20s target

## Visual identity (from the project)
- Pain section background: `#0F4E0E` (primary) — exact match to the live `PainPoints` section's `bg-primary`
- Pain card: `#0A3E09` (accent-600) background, `#052D05` (accent-700) border — matches live `bg-accent-600 border-accent-500`... using the closest documented tokens
- Pain card ✗ badge: `#B03D2B` (error) background, cream glyph
- Solution section background: `#FAF3E3` (cream)
- Solution card: `#F1E3C6` (surface), `border` hairline
- Solution icon chip: `#FCF1E8` (accent-2-100) background, `#8A5513` (accent-2-700) icon tint
- Text on dark: `#FAF3E3` (background token, used as light text)
- Text on light: `#201E1D`
- Display font: Fraunces (headlines only)
- Body font: Figtree
- Strongest visual element: the real pain-card treatment (dark green + red ✗ badge) — it's distinctive and already shipped, not invented for the video

## Share copy (draft)
El domingo mirando la nevera. El súper sin lista. El miércoles sin plan. Fresco resuelve las tres en 30 segundos, cada semana.

## Audio direction
- Role: warm bed that shifts weight with the picture — lower and more grounded under the pain section, opens up and lightens the moment the solution section lands
- Music: same bundled track as v1 (`happy-beats-business-moves-vol-12`, 109.96 BPM) for brand consistency across both brags
- Music treatment: fades in low under the hook, stays understated and slightly darker-feeling through the pain cards (lower volume, no bright elements), a clear volume lift right at the turn (S3, the cream cut), holds warm through the solution cards, fades out under the outro hold
- Music cue guidance: reuse the same preset (`cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`). Target the turn (S3, cream reveal) on a strong cue near 8.74s if the scene timing lands close; otherwise use natural timing — the turn's visual snap is the more important cue than the audio.
- Audio-reactive treatment: none (kept v1 simple for the same reason — skip for a fast, reliable render)
- SFX posture: sparse. A slightly heavier/duller thud on each pain-card arrival (not the bright card-arrive sound from v1 — something more "weighted"); a distinctly brighter, lighter sound on the turn and on the solution cards, to make the audio itself carry part of the weight→light arc
- Audio-coupled moments: 3 pain-card arrivals (weighted sound), the turn (bright accent), 3 solution-card arrivals (light sound)
- Restraint rule: even the "heavy" pain-section sound stays soft and short — this is a calm product, never harsh or startling

## Storyboard

### Scene 1 — Hook — 3s
Dark green (`#0F4E0E`) field. Fraunces headline "¿Cuántas veces has acabado comiendo lo que sea?" in cream, centered, settles and holds.
Sequential/interaction: none
Audio intent: bed enters low and grounded
Audio-coupled idea: none
Music: low, warm
Transition mood: clean wipe → Scene 2

### Scene 2 — Pain points — 6s
Same dark green field continues (no scene cut needed visually — this is a continuation, not a hard break). Three real pain cards arrive one at a time, each holding before the next: "El domingo por la tarde." / "El súper sin lista." / "El miércoles a las 8pm." — dark card, red ✗ badge, cream text, matching the live `PainPoints` treatment exactly.
Sequential/interaction: yes — 3 cards, one at a time, each gets its full reading floor (these are short lead + one sentence, ~1.5-2s each)
Audio intent: weighted, a little tired — each card arrival lands with a soft, dull thud
Audio-coupled idea: 3 card arrivals, weighted sound each
Music: stays low
Transition mood: hard cut (the turn) → Scene 3

### Scene 3 — The turn — 2.5s
Hard cut to cream (`#FAF3E3`). Fresco wordmark pops in, centered, clean. No text yet — the color shift IS the message.
Sequential/interaction: none
Audio intent: the release — volume lifts, brightens
Audio-coupled idea: one bright accent on the cut itself
Music: lift starts here
Transition mood: soft crossfade → Scene 4

### Scene 4 — Solution — 5.5s
Same cream field continues. Three real solution cards arrive (icon chip + value + description): "En 30 segundos" / "Sin repetir" / "Lista ya hecha" — light surface cards, green/orange icon tint.
Sequential/interaction: yes — 3 cards, staggered arrival, light sound each
Audio intent: settled, confident, warm
Audio-coupled idea: 3 card arrivals, light sound
Music: warm and open
Transition mood: soft crossfade → Scene 5

### Scene 5 — Outro — 3s
Cream field. Fraunces line "Deja de improvisar en el súper." (súper. in primary green). Fresco wordmark holds beneath.
Sequential/interaction: none
Audio intent: calm close
Audio-coupled idea: none
Music: fades out under the hold
Transition mood: — (final)

**Music mood for this video:** same warm editorial instrumental as v1, shaped by volume/brightness rather than a different track — low and grounded through the pain section, lifts at the turn, warm through the close
**Audio summary:** the picture goes dark-to-light once, and the music's volume/brightness lift lands exactly on that turn — the two channels tell the same story.
