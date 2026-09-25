# Brag Plan: Fresco

## What is this app?
Fresco generates a full weekly menu (21 meals) and an aisle-grouped shopping list for a Spanish household in under 30 seconds, and keeps getting more accurate week over week by learning from what people actually cook — not what they say they like.

## The angle
Not a joke premise — an earnest relief premise. The real emotional hook already lives in the app's own copy: "Deja de improvisar en el súper" / "no sabes qué cocinar, compras de más y acabas tirando comida." The video's job is to show the exact 3-question-to-finished-week arc that removes that weekly dread, landing on the one differentiator that isn't table stakes: it learns from real cooking behavior, not a taste quiz.

## Hook (first 2-3 seconds)
The app's real H1, verbatim: "Deja de improvisar en el **súper.**" — cream background, Fraunces serif, the word "súper." in deep green as the accent beat. No product chrome yet. Just the claim.

## Key moments (the middle)
- The 3-step onboarding wizard ticking through its step indicator (Paso 1 de 3 → 2 → 3) with real chip labels (Vegetariano, Sin gluten, Española) popping into their selected state — this is the entire "cost" the user pays.
- The weekly calendar assembling itself: 21 meal cards staggering into a 7-day grid, real dish photography, day headers Lunes→Domingo. This is the "30 segundos" claim made visible, not stated.
- The shopping list flipping into view, ingredients already grouped under aisle headers, one item getting checked off. This is "zero-maintenance," shown as a fact not a slide.

## Outro / punchline
Cut back to the cream field. Fraunces line: "Aprende de lo que realmente cocinas." Logo mark settles and holds. No CTA button — the brag is the proof, not a pitch.

## User flow worth showing
1. **Entry** — 3-step onboarding wizard (diet/allergens/cuisines chips, household size), real step-indicator UI.
2. **Key action** — "Generando menú…" (brief), then the 21-card weekly calendar populating.
3. **Result** — shopping list grouped by aisle, one line checked off, total line settling.

## Tone
- Preset: `polished`
- Creative direction: quiet, confident Sunday-planning relief — an editorial food-brand film, not a startup pitch
- Interpretation: fewer scenes, longer holds, soft crossfades. Confidence through restraint, not speed. Real UI content stays legible — no flash-cuts on text a viewer needs to read.

## Format: landscape — 1920x1080
## Duration: 20s target

## Visual identity (from the project)
- Background: `#FAF3E3` (warm cream)
- Card surface: `#FBF6EC` (surface-raised, one step lighter than background, hairline border `color-mix(in srgb, #201E1D 16%, transparent)`)
- Primary/accent: `#0F4E0E` (deep green)
- Secondary accent: `#DF8C26` (burnt orange) — used sparingly, one-accent discipline
- Text: `#201E1D`
- Display font: Fraunces (headlines only, h1/h2)
- Body font: Figtree
- Strongest visual element: the 21-card weekly calendar grid with real curated dish photography (warm, editorial — see `HERO_PHOTOS` in `components/landing/hero.tsx` for reference imagery/mood)

## Share copy (draft)
Tu menú semanal y tu lista de la compra, listos en 30 segundos. Fresco aprende de lo que realmente cocinas — no de lo que dices que te gusta.

## Audio direction
- Role: warm, restrained instrumental bed with sparse professional accents
- Music: calm, confident, mid-tempo instrumental (acoustic/warm electric, not corporate-stock — should feel editorial, not SaaS)
- Music treatment: fades in under the hook line, sits low under UI beats, small swell under the calendar-grid reveal (the centerpiece), gentle fade on the outro hold
- Music cue guidance: to be detected at composition time (no bundled preset picked yet — Hyperframes selects and analyzes). Target 1 strong cue at the calendar-grid reveal (~scene 3 start) and 1 at the outro logo settle.
- Audio-reactive treatment: subtle only — at most a soft glow/presence tied to the calendar-grid reveal, never waveform bars or aggressive pulsing
- SFX posture: sparse, motion-matched — a soft chip-select tick, one soft "card arrive" sound per calendar stagger group (not per-card), one soft chime on the shopping-list check
- Audio-coupled moments: step-indicator dots filling one by one (tick per step), chip selection (soft tick), calendar cards arriving in staggered groups, one checkbox tick on the shopping list
- Restraint rule: no drops, no risers, no chaotic-tone energy — this is a calm product, the audio must never oversell it

## Storyboard

### Scene 1 — Hook — 3s
Cream `#FAF3E3` field. Fraunces headline "Deja de improvisar en el súper." fades/slides up, word "súper." in `#0F4E0E`. Fresco wordmark settles top-left, small.
Sequential/interaction: none
Audio intent: warm bed fades in under the line settling
Audio-coupled idea: none — let the line breathe in silence for its first beat
Music: warm instrumental bed, entering
Transition mood: soft crossfade → Scene 2

### Scene 2 — Onboarding — 4s
Recreate the wizard card: step-indicator dots "Paso 1 de 3" → "Paso 2 de 3" → "Paso 3 de 3" advance in sequence, each fill-in a distinct beat. Diet/cuisine chips pop into selected state underneath (Vegetariano, Sin gluten, Española) — 3 chips, one after another.
Sequential/interaction: yes — 3 step-dots fill one by one, then 3 chips select one by one underneath, same card
Audio intent: light, mechanical-but-pleasant — the "small effort" beat
Audio-coupled idea: soft UI tick per step-dot fill and per chip select
Music: bed continues, understated
Transition mood: clean wipe → Scene 3

### Scene 3 — Generating → weekly calendar reveal — 7s
Brief "Generando menú…" with spinner (0.6s), then hard cut to the 7-day calendar grid. 21 meal cards stagger in (by day column, left to right), real dish photography, day headers Lunes→Domingo, category labels under each. This is the centerpiece — longest hold, most visual density.
Sequential/interaction: yes — cards arrive in staggered day-column groups, not all at once
Audio intent: the payoff beat — small swell under the reveal, then settle
Audio-coupled idea: one soft "arrive" sound per day-column group (7 groups, not 21 individual hits)
Music: swell starts here, this is the emotional high point
Transition mood: soft crossfade → Scene 4

### Scene 4 — Shopping list — 4s
Cut to the shopping list view: aisle-header cards ("Frutas y verduras," "Carnicería," etc.) slide in with their grouped ingredients beneath. One checkbox ticks to checked. "Total estimado del menú de esta semana" line settles at the bottom.
Sequential/interaction: yes — aisle groups arrive one by one, then one checkbox ticks
Audio intent: satisfying, tidy — the "done" feeling
Audio-coupled idea: one soft chime on the checkbox tick
Music: settling down from the Scene 3 swell
Transition mood: soft crossfade → Scene 5

### Scene 5 — Outro / punchline — 2s
Back to the cream field. Fraunces line "Aprende de lo que realmente cocinas." Logo mark holds, centered, settled.
Sequential/interaction: none
Audio intent: warm fade-out, calm close
Audio-coupled idea: none
Music: fades out under the hold
Transition mood: — (final)

**Music mood for this video:** calm, confident, editorial-warm instrumental — not corporate-stock, not upbeat-hype
**Audio summary:** a quiet, warm bed that swells once — right as the weekly calendar assembles itself — then settles back down through the shopping list into a soft fade on the closing line.
