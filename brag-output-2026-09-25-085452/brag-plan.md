# Brag Plan: Fresco — Merged cut (problem + flow)

## What is this app?
Fresco generates a full weekly menu (21 meals) and an aisle-grouped shopping list for a Spanish household in under 30 seconds, and gets more accurate every week by learning from what people actually cook.

## The angle
Third brag video for Fresco, merging the two prior cuts on explicit request ("me gustan los dos mensajes"):
- v1 (`brag-output/`) — the product flow: onboarding → weekly calendar → shopping list.
- v2 (`brag-output-2026-09-25-084635/`) — the emotional case: real pain points → relief → what Fresco does.

Rather than concatenating both videos back to back (each already has its own hook/outro/logo beat, which would read as two ads stitched together), this cut keeps ONE narrative arc: the real pain (from v2, verbatim) leads into the real flow (from v1, verbatim) as the concrete proof of the relief — dropping v2's abstract "3 things Fresco does" stat cards, since the flow demo shows the same claim more convincingly than a card ever could.

## Structure
1. **Hook + pain grid** (0-9s, dark green, from v2) — "¿Cuántas veces has acabado comiendo lo que sea?" + 3 real pain cards.
2. **The turn** (9-11.3s, hard cut to cream) — Fresco wordmark.
3. **Onboarding** (11.6-15.2s, from v1) — 3-step wizard, step dots + diet chips.
4. **Generating → calendar** (15.3-21s, from v1) — spinner, then 21-meal weekly calendar (7 real dish photos, one per day).
5. **Shopping list** (21.5-26.3s, from v1) — aisle-grouped list, checkbox tick, total.
6. **Outro** (26.4-30s, from v2) — "Deja de improvisar en el súper." + logo hold.

## Format: landscape — 1920x1080
## Duration: 30s (extended from the usual 15-25s brief by deliberate user direction — this is two videos' worth of real content merged into one arc, not padding)

## Bugs found and fixed during this build
- Word-spacing collapse on the hook headline: making `.hook-line` itself a flex container (for independent centering) caused the browser to strip whitespace text nodes between the `.hw` word spans — flex children don't preserve inter-element whitespace the way normal inline-block flow does. Fixed by splitting into an outer flex-centered wrapper and an inner plain-block text element (same fix pattern used in v2 standalone, applied here too).
- `#genWrap` ("Generando menú…") had no default-hidden CSS state, so it sat visible and overlapping the onboarding wizard from t=9 (scene start) until its own fade-out at t=15.75, well before its intended t=15.3 appearance. Caused `hyperframes check` layout overlap errors and a cascading WCAG contrast failure. Fixed by giving `.gen-wrap` `opacity: 0` as its default state and adding an explicit fade-in at t=15.3.

Both confirmed fixed via `hyperframes check` (0 errors) and visual frame review of the rendered output.

## Share copy (draft)
El domingo mirando la nevera. El súper sin lista. El miércoles sin plan de cena. Fresco genera tu menú semanal completo y la lista de la compra en 30 segundos — deja de improvisar en el súper.

Full audio/visual/copy detail for each half lives in the two source plans:
- `brag-output/brag-plan.md` (flow half)
- `brag-output-2026-09-25-084635/brag-plan.md` (pain half)
