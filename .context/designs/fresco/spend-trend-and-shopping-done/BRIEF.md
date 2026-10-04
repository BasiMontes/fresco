# Design brief — Fresco / spend-trend-and-shopping-done
Tool session: NEW project in Claude Design (mode FULL, first batch; the tool knows nothing about the product yet, so the whole contract is inlined)
Date: 2026-10-04 · Stories: FRESCO-841, FRESCO-842 · Method: Mode B (the brief is handed to the user; no design MCP was used)

## Mission
Design 2 screens (two states of screens that already exist) for Fresco, a weekly meal-planning web app. We describe WHAT each screen must accomplish; HOW it looks is your call: layout, composition, hierarchy, component choices and micro-interactions are fully delegated to you. Your only hard boundary is the design contract below: never invent colors, fonts or spacing values outside it. When done, export and return the files as described in "Export & return".

## Product context
Fresco generates a weekly menu (3 meals x 7 days) that learns from what the household actually cooks, and builds the shopping list from it. The user is a person who is tired of deciding what to cook every week. Tone: a calm printed weekly planner, not a dashboard. Spanish (Spain) UI.

Thesis that governs every decision: *Fresco is a weekly ritual, not an app. You decide once and forget about it.* Calm over busy, generous whitespace, few visible controls, near-monochrome interface so the food supplies the color, hairline borders before shadows, unhurried motion.

## Frozen design contract (non-negotiable)
- **Colors:** primary `#0F4E0E` (green), secondary `#DF8C26` (orange, used for the one action that matters), tertiary `#6F5F43` (secondary text), background `#FAF3E3`, surface `#F1E3C6`, surface-raised `#FBF6EC` (the card surface, one step lighter than the background), text `#201E1D`, border = text at 16% opacity, error `#B03D2B`. Scales available: accent-100..900 (greens, `#E1E8E0` to `#011101`), accent-2-100..900 (ambers, `#FCF1E8` to `#422605`), neutral-100..900 (warm neutrals, `#FBF6EC` to `#2F281C`).
- **Typography:** Fraunces only for h1 and h2 (weight 400, never bold; h1 44px/1.04, h2 32px/1.08, display-light 28px weight 300). Everything else is Figtree: h3 22px/600, h4 18px/600, h5 15px/600, h6 12px/600 uppercase tracked, body-md 15px/1.55, body-sm 13px/1.55, label 14px/600, caption 11px.
- **Spacing scale:** 4.4, 8.8, 13.2, 17.6, 26.4, 35.2px; page rhythm 52.8, 70.4 and 105.6px.
- **Radius:** sm 6px, md 12px, lg 16px, image 16px, card 20px, full 999px. Every button and every tag is a full pill, no exceptions.
- **Elevation:** hairline first. A card is `surface-raised` + 1px border + shadow-sm (`0 1px 2px` at 14% of `#2F281C`). shadow-md is for cards that claim attention, shadow-lg is for true overlays only.
- **Components:** buttons are pills (`button` primary green, `button-action` orange, `button-secondary` outlined, `button-ghost` text only, `button-icon` 36px circle). Tags are hairline pills with tertiary text; allergen tags are the only tinted ones. Checkboxes are circular (square variant for single agree toggles).
- **Themes:** the system has a light and a dark theme; show both for each screen.
- **Voice (applies to every string on the screens):** Spanish (Spain), always informal "tú". Calm, not hype: no exclamation marks and no emoji. Direct, no padding. Concrete, never generic. Example of the register: "No hay recetas guardadas todavía." The only place the tone rises is the learning insight card, which is not part of these screens.

## Screens requested
### 1. home-spend-trend-card — Weekly spend trend card on the home screen
- Route: `/menu` (the home dashboard). The card sits among the home cards, next to the existing "Gasto semanal estimado" tile.
- Purpose: let the user see how her estimated weekly grocery spend has evolved over the last weeks, and whether it truly goes up or down.
- User stories: FRESCO-841 — Tendencia de gasto: leer la evolución con semanas y cifras visibles (reworks FRESCO-535, which shipped without design).
- The user must be able to:
  - read, from the card alone and without hovering or tapping, the week and the amount in euros of every week that has data;
  - judge the evolution honestly: a 2 € difference on a 45 € week must not look like a surge;
  - see a week without a menu as an explicit gap, never as 0 €;
  - understand at a glance when there is not enough history yet.
- What is wrong today (so you can fix it, not copy it): with few weeks of data the line is squeezed against the right edge and the last point is clipped; the scale runs from the series minimum to its maximum, so any two close amounts fill the whole height; the amounts exist only in a hover tooltip, which does not exist on a phone.
- States the ACs demand:
  - **Not enough history** (0 or 1 week with data): the message "Todavía no hay suficientes semanas para mostrar una tendencia de gasto." and no chart.
  - **Short series** (exactly 2 consecutive weeks, e.g. 45,00 € and 47,00 €): both points whole and inside the card; the horizontal span covers only the weeks that exist.
  - **Full series** (up to the last 8 weeks, e.g. 38,00 / 41,50 / 40,00 / 44,20 €).
  - **Series with a gap** (weeks 1, 2 and 4 have a menu, week 3 does not).
- Viewport: mobile 390px first (that is where it fails today), and desktop 1440px.

### 2. shopping-list-all-bought — Shopping list when nothing is left to buy
- Route: `/shopping-list`.
- Purpose: tell the user she is done with this week's shopping and offer a natural next step, instead of leaving an almost empty screen.
- User stories: FRESCO-842 — Lista de la Compra: ver qué hacer cuando ya no quedan pendientes.
- The user must be able to:
  - know at a glance that every item of this week's list is bought;
  - go to her menu, to the recipes or to the weekly calendar;
  - still see the existing weekly summary card (estimated total of the week's menu) and the existing copy / download CSV actions.
- What is wrong today: with 0 items pending, only the summary card and the two export buttons remain; the rest of the screen is empty and offers nothing to do.
- Proposed copy (you may refine the wording, keeping the voice rules): message "Has comprado todo lo de esta semana."; actions "Ver mi menú", "Ver las recetas", "Ver el calendario".
- Decision already taken, do not reopen it: no carousel of recommendations or suggested content (a "Sugerencias para ti" block was rejected earlier). The next steps are navigation to screens that already exist, nothing else.
- States the ACs demand:
  - **All bought** (the new state, 0 items pending).
  - **With pending items** (unchanged; include it only as the reference the new state replaces).
  - **No list yet** (an empty state that already exists and invites to generate the list; unchanged).
- Viewport: desktop 1440px and mobile 390px.

## Hard constraints
- Name each screen file or frame with its `{screen-slug}` exactly: `home-spend-trend-card` and `shopping-list-all-bought` (one file per screen, each containing its states). The repo maps files by slug.
- No new tokens. A value not in the frozen contract is a defect, not a creative choice.
- UI copy is Spanish (Spain) even if this brief is in English.
- Accessibility AA: text contrast and non-text contrast (a chart line and its points must be distinguishable without relying on color alone), tap targets that work on a phone.
- Respect reduced motion: nothing bounces; if anything animates, it is short and quiet.

## Export & return
Attach to your first message the two reference screenshots of today's state (the home spend-trend card on a phone, and the shopping list with 0 pending). They show what is being replaced.

**Claude Design** (`claude.ai/design`): paste this whole brief as your first message in the chat pane. Iterate until satisfied. Then Export (top-right) -> **Save as folder** -> place the bundle contents into `.context/designs/fresco/spend-trend-and-shopping-done/` in the repo. (If you use "Send to local coding agent", tell the agent that destination path.)

When the files are in place, come back to the agent session and confirm. The screen-mapping phase resumes from there: the §4 spec and the §8 row for FRESCO-841 and FRESCO-842 are written from what comes back, and only then does development start.
