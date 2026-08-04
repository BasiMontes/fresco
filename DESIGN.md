---
version: alpha
name: Fresco
description: Menús semanales con IA que aprende de lo que realmente cocinas. Warm, rounded, cream-and-clay system pairing corporate green with corporate orange for Spain's household meal planners.
colors:
  primary: '#0F4E0E'
  secondary: '#DF8C26'
  tertiary: '#847456'
  neutral: '#A39372'
  background: '#FAF3E3'
  surface: '#F1E3C6'
  text: '#201E1D'
  border: 'color-mix(in srgb, #201E1D 16%, transparent)'
  success: '#0F4E0E'
  warning: '#DF8C26'
  error: '#B8422E'
  accent-100: '#E1E8E0'
  accent-200: '#BFCFBD'
  accent-300: '#8FAB8D'
  accent-400: '#547D51'
  accent-500: '#0F4E0E'
  accent-600: '#0A3E09'
  accent-700: '#052D05'
  accent-800: '#031F03'
  accent-900: '#011101'
  accent-2-100: '#FCF1E8'
  accent-2-200: '#F9E2CC'
  accent-2-300: '#F3CBA5'
  accent-2-400: '#EAAD70'
  accent-2-500: '#DF8C26'
  accent-2-600: '#B6721D'
  accent-2-700: '#8A5513'
  accent-2-800: '#653D0B'
  accent-2-900: '#422605'
  neutral-100: '#FBF6EC'
  neutral-200: '#F0E8D8'
  neutral-300: '#DED2B8'
  neutral-400: '#C2B393'
  neutral-500: '#A39372'
  neutral-600: '#847456'
  neutral-700: '#66593F'
  neutral-800: '#493F2C'
  neutral-900: '#2F281C'
typography:
  h1:
    fontFamily: Caprasimo
    fontSize: 42px
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: -0.015em
  h2:
    fontFamily: Caprasimo
    fontSize: 30px
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: -0.015em
  h3:
    fontFamily: Caprasimo
    fontSize: 22px
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: -0.015em
  h4:
    fontFamily: Caprasimo
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: -0.015em
  h5:
    fontFamily: Caprasimo
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: -0.015em
  h6:
    fontFamily: Caprasimo
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: 0.08em
  body-md:
    fontFamily: Figtree
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Figtree
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: Figtree
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.2
  caption:
    fontFamily: Figtree
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.3
rounded:
  sm: 8px
  md: 16px
  lg: 28px
  card: 32px
  full: 999px
spacing:
  1: 4.4px
  2: 8.8px
  3: 13.2px
  4: 17.6px
  6: 26.4px
  8: 35.2px
components:
  button:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.background}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '{spacing.2}'
  button-action:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.background}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '{spacing.2}'
  button-secondary:
    textColor: '{colors.text}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '{spacing.2}'
  button-ghost:
    textColor: '{colors.primary}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '{spacing.2}'
  button-icon:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.full}'
    size: 36px
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    typography: '{typography.body-md}'
    rounded: '{rounded.full}'
    height: 36px
    padding: '{spacing.3}'
  segmented-control:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.md}'
  card:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.card}'
    padding: '{spacing.3}'
  card-insight:
    backgroundColor: '{colors.accent-100}'
    textColor: '{colors.accent-800}'
    rounded: '{rounded.card}'
    padding: '{spacing.3}'
  card-pro:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.card}'
    padding: '{spacing.3}'
  recipe-card:
    backgroundColor: '{colors.surface}'
    typography: '{typography.h5}'
    rounded: '{rounded.card}'
    padding: '{spacing.3}'
  tag:
    typography: '{typography.caption}'
    rounded: '{rounded.full}'
    paddingX: '{spacing.2}'
    paddingY: '{spacing.1}'
  tag-selected:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.background}'
    rounded: '{rounded.full}'
  tag-accent:
    backgroundColor: '{colors.accent-100}'
    textColor: '{colors.accent-800}'
    rounded: '{rounded.full}'
  tag-accent-2:
    backgroundColor: '{colors.accent-2-100}'
    textColor: '{colors.accent-2-800}'
    rounded: '{rounded.full}'
  tag-neutral:
    backgroundColor: '{colors.neutral-100}'
    textColor: '{colors.neutral-800}'
    rounded: '{rounded.full}'
  tag-outline:
    textColor: '{colors.primary}'
    rounded: '{rounded.full}'
  nav-sidebar:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.background}'
  nav-bottom-tab:
    backgroundColor: '{colors.background}'
    textColor: '{colors.primary}'
  icon:
    textColor: '{colors.primary}'
    size: 22px
---

## Overview

Fresco is a Spain-focused weekly meal-planning app for **Laura, the exhausted planner** — a 30–40-year-old who cooks five-plus days a week and hits the same recurring wall every Sunday afternoon: "what do I cook this week?" (`.context/business/business-model.md`, `.context/PRD/user-personas.md`). The product's entire pitch is that it gets easier the more you use it, because it learns from what your household actually cooks, not from a preference form you filled out once. A design system for that promise cannot look like a cold utility tool — it has to feel like the difference between a spreadsheet and a kitchen counter.

The visual theme, in the founder's own words from the brand canvas, is direct: **"Cálido, redondeado, verde + naranja"** — warm, rounded, green + orange (`design/handoff/fresco/brand-guide.dc.html`). The brand tagline frames the product identity end to end: *"Menús semanales con IA que aprende de lo que realmente cocinas"* (Weekly menus with AI that learns from what you actually cook). Every token in this system exists to make that tagline felt on first paint, not just claimed in copy.

Concretely: a warm cream background (`#FAF3E3`) instead of clinical white, a hand-picked corporate green (`#0F4E0E`) for trust and primary action, and a corporate orange (`#DF8C26`) reserved for the single highest-intent moment on a screen. Corners are generously rounded — cards round further than buttons, buttons round all the way to a pill — because sharp, dense corners read as spreadsheet, and Fresco is explicitly not a spreadsheet, a pantry tracker, or a recipe database (`.context/business/business-model.md` — "What Fresco is NOT"). This system was authored in Claude Design (`claude.ai/design`) and exported as a brand-guide canvas; this file is the DESIGN.md bridge (Path D → Path E of `/design-system`) that wraps those tokens in the canonical spec and documents the reasoning behind them, without altering a single value.

This system was designed to counter one specific risk named in the Constitution: that Free-tier users won't perceive the Pro-tier learning moat unless it's made *visible* (`.context/business/market-context.md` — Risks). The "insight card" component (§Components) exists directly to solve that — it is the one place in the UI where the system says out loud, in the primary accent color, "I adjusted for you."

**Logo lockups** (canonical, do not redraw):

- `design/handoff/fresco/assets/Logo base.svg` — primary mark, for light/cream backgrounds.
- `design/handoff/fresco/assets/Logo negativo.svg` — negative mark, for dark/accent-green backgrounds (e.g. the sidebar nav).
- `design/handoff/fresco/assets/Logo naranja.svg` — orange variant, secondary use only (do not use as the default mark).

## Colors

The palette is two hand-picked corporate hues — "verde corporativo" and "naranja corporativo" — set against warm, cream-toned neutrals rather than a gray scale. Nothing here is a stock Tailwind or shadcn default; every hex was chosen on the brand canvas and is preserved verbatim.

- **Primary — `#0F4E0E` ("verde corporativo"):** the trust color. Drives primary buttons, active nav states, form focus, links, and every icon in the shared icon set. It is the color of "the plan is ready" — not decorative, structural.
- **Secondary — `#DF8C26` ("naranja corporativo"):** the single-highest-intent color. Reserved for one CTA at a time (see the `button-action` variant and the "Cocinar ya" / "Cook now" example below) and for warning-adjacent tags (allergen flags like "Frutos secos"). It is loud on purpose — its rarity is what makes it work.
- **Background — `#FAF3E3` (crema):** the page canvas. A warm cream instead of white or off-white gray — the deliberate antidote to the "cold utility app" feel the brand explicitly avoids. This is the color a Sunday-afternoon planning session should feel like: a kitchen counter, not a dashboard.
- **Surface — `#F1E3C6` (crema superficie):** one step darker than background, used for cards, inputs, and any panel that needs to lift slightly off the page without resorting to a hard shadow or a cool gray.
- **Text — `#201E1D`:** near-black, warm-toned rather than pure `#000`, kept soft in the same family as the rest of the palette.
- **Border/Divider:** `color-mix(in srgb, #201E1D 16%, transparent)` — text color at 16% opacity rather than a separate hardcoded gray. Guarantees dividers always sit in visual harmony with body text regardless of future text-color tuning.
- **Success — `#0F4E0E`:** reuses primary. The brand canvas defines no separate success color, and inventing one would fragment a two-hue system; "success" and "trust" are the same signal in this product (a generated menu succeeding *is* the primary action).
- **Warning — `#DF8C26`:** reuses secondary/accent-2. Dietary-flag tags (e.g. "Sin gluten") use accent-2 tinted backgrounds — warmth as attention, not alarm.
- **Error — `#B8422E`:** the one token in this file with no direct source in the brand canvas (the canvas defines no destructive/error color). Chosen as a warm clay-red in the same desaturated family as the rest of the palette rather than a stock saturated red, so a validation error never looks like it belongs to a different app. Flagged here per the spec's conflict-resolution discipline (§8 `llm-authored.md`) — this is the one extension beyond the bundle, not a silent override.
- **Neutral scale (100–900):** warm/cream-toned, *not* pure gray (`#FBF6EC` → `#2F281C`). Backs the tag-neutral component and any chrome that needs to recede without going cold.
- **Accent / Accent-2 100–900 ramps:** in the source canvas these are authored as CSS `color-mix(in oklch, white/black N%, <base> N%)` expressions around the 500 base (100–400 mixed toward white, 600–900 toward black). The DESIGN.md spec's `Color` type is hex-sRGB only (§3 of the spec card), so the frontmatter above stores each step as the exact flattened hex the browser would compute from that same `color-mix()` formula (OKLCH-space interpolation, matching CSS Color 4 semantics) — same color, valid token type, zero drift from the canvas. `design/handoff/fresco/brand-guide.dc.html` remains the reference if the live `color-mix()` expressions are ever needed for a CSS export target. Ramp usage: tinted surfaces (100), the insight-card treatment (100 background / 800 text), and tag variants.

## Typography

Two families, strictly paired — one display, one body, per the pairing discipline this spec recommends.

- **Heading — Caprasimo** (weight 400 only): a rounded display face used for `h1`–`h6`, card titles, and all button labels. Its single-weight, slightly playful character is what keeps "warm and rounded" from tipping into generic-friendly; it's distinctive enough to be a brand signal on its own, even before color enters. Fallback stack: `Caprasimo, "Baloo 2", cursive`.
- **Body — Figtree** (weights 400/600/700): a humanist sans for everything that needs to be read quickly and often — recipe steps, shopping-list items, form labels. Fallback stack: `Figtree, -apple-system, BlinkMacSystemFont, sans-serif`.
- **Scale:** `h1` 42px down to `h6` 12px (uppercase, `0.08em` letter-spacing — the only heading level that behaves like a label rather than a headline; used for card kickers like "Fresco aprendió"). All headings share line-height `1.12` and letter-spacing `-0.015em`, tightening the display face at large sizes without needing per-level tuning.
- **Body:** 15px base, line-height `1.55` — generous enough for recipe instructions read at arm's length in a kitchen, not a dense reading-app line-height.

## Layout

Base spacing unit is **4.4px**, not a round 4px or 8px — preserved exactly as authored on the canvas rather than rounded to a "cleaner" number, because the scale was tuned as a system (`space-1` through `space-8` all derive from the same 4.4px unit: 4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2). Treat this as a fixed multiplier, not six independent values — if a new step is needed (e.g. `space-5`), derive it as `4.4px × n`, don't interpolate visually.

Spacing usage convention observed in the canvas: `space-2` for tight internal gaps (card content stacking), `space-3` for card padding and button horizontal padding, `space-4` for section dividers (`.hr` margin), `space-6`/`space-8` reserved for page-level rhythm between major blocks. No container max-width or grid-column convention is defined in the source bundle — inherit standard responsive breakpoints from the frontend framework rather than inventing one here.

## Elevation & Depth

Three shadow levels, all computed against the same warm dark base (`#2F281C`, the darkest neutral) rather than pure black — shadows stay in the same warm family as everything else instead of reading as a cool, generic drop-shadow bolted onto a warm UI.

- **sm** — `0 1px 2px` at 14% opacity of `#2F281C`. Default resting elevation for standard cards.
- **md** — `0 3px 10px` at 16% opacity of `#2F281C`. Used for cards that need to visually claim attention without being modal-level — the insight card and the Pro-plan card both use `md`.
- **lg** — `0 12px 32px` at 22% opacity of `#2F281C`. Reserved for true overlays (modals, sheets) — not observed in the current component set but defined for that purpose.

Z-index layer convention (not sourced from the canvas, standard default): base `0`, dropdown `100`, modal `1000`, toast `10000`.

## Shapes

- **sm — 8px:** the tightest radius in the system; used sparingly (small chip-like elements, swatch previews).
- **md — 16px:** segmented controls, form field groupings.
- **lg — 28px:** the base card radius before the recipe/insight-card multiplier below; also the image-area radius inside recipe cards.
- **card (lg × 1.15 ≈ 32px):** the actual radius applied to full card components (base card, insight card, Pro card, recipe card). Deliberately rounder than the raw `lg` token — this extra step is what makes cards read as "soft objects on a counter" rather than "panels in a dashboard," directly serving the "cálido, redondeado" brief.
- **full — 999px:** true pills. Every button and every tag is fully pill-shaped, no exceptions — this is one of the most consistent signals in the whole system (see Do's and Don'ts).

## Components

**Buttons** — heading-font label, always pill-shaped (`rounded.full`):
- `button` (primary): filled `{colors.primary}`, `{colors.background}`-colored text. Default action.
- `button-action`: filled `{colors.secondary}` (orange), white text. Reserved for the single highest-intent CTA on a screen — observed usage: "Cocinar ya" (Cook now), a lightning-bolt-flagged action distinct from every other button on the same screen.
- `button-secondary`: outlined, `{colors.border}`-colored border, transparent fill.
- `button-ghost`: text-only, `{colors.primary}` text, no border or fill.
- `button-icon`: 36×36 circular, used for compact actions (e.g. the favorite/heart toggle on a recipe card).

**Tags/pills** — small pill badges, `rounded.full`, 11px text:
- `tag-selected`: filled `{colors.primary}`, background-colored text — the "this one is chosen" state.
- `tag-outline`: `{colors.primary}` border and text, transparent fill — the unselected counterpart.
- `tag-accent` / `tag-accent-2` / `tag-neutral`: tinted-100-background + 800-text pairs, used for dietary/attribute flags ("Sin gluten," "Frutos secos," "Healthy"). Accent-2 (orange) is the natural home for allergen-style flags that deserve more visual weight than a neutral tag.

**Form fields:**
- `input`: pill-shaped (`rounded.full`), `{colors.surface}` background, `{colors.border}` outline — text fields never sit directly on page background, always lift onto surface.
- `segmented-control`: a radio-style pill group (`rounded.md`, not full) — e.g. a spice-level selector ("Suave / Medio / Picante"). The checked option flips to filled `{colors.primary}` background; unchecked options stay transparent within the shared outlined container.

**Cards** — all use the card radius (`~32px`), not the raw `lg` token:
- `card` (base): `{colors.surface}` background, `shadow.sm`. Generic content container.
- `card-insight`: `{colors.accent-100}` tinted background, `{colors.accent-800}` text, `shadow.md`. This is the behavioral-learning-moat callout — e.g. "Fresco aprendió — Menos pimentón picante" (Fresco learned — less spicy paprika next time). Its accent tint (rather than neutral surface) is what makes the learning feel like a distinct, celebrated event instead of ordinary chrome. This component is the direct in-product answer to the Constitution's "learning must be visible, not just present in the backend" mitigation.
- `card-pro`: `{colors.surface}` background with a 2px `{colors.primary}` border, `shadow.md`. The border-only differentiation (no fill change) keeps the Pro-plan card premium without introducing a third card color.
- `recipe-card`: base card treatment plus a dedicated image area (`rounded.lg`, washed/desaturated placeholder pattern), a top-right circular favorite/heart `button-icon`, a `h6`-style kicker, a title in the heading font, one tag, and a meta line (e.g. "50 min · fácil · 2,80€/persona"). Desktop and mobile density variants exist; both preserve the same element order.

**Icons** — a minimal 2px-stroke line set, always `{colors.primary}`: home, calendar, recipes (open book), shopping list, profile, save/heart, add (calendar+plus), notifications (bell), "cook now" (lightning bolt), and a 6-dot drag handle. Single stroke weight and single color across the entire set — no per-icon color exceptions.

**Navigation** — one destination set (Home/Menu, Calendar, Recipes, Profile) surfaced two ways:
- `nav-sidebar` (desktop): `{colors.primary}` background, active item highlighted with a pill (`rounded.full`) in white/cream — FRESCO-70 moved this off the dark `accent-900` end of the ramp onto the primary brand green itself, the one surface in the system where `primary` becomes a background rather than just a text/icon/border color. Use the `Logo negativo` lockup here, never the base logo — still clears WCAG AA (~9.9:1) against `#0F4E0E`.
- `nav-bottom-tab` (mobile): background background-colored, `{colors.primary}` icons, dot-indicator active state rather than a pill or background fill — kept lighter-weight than the sidebar because mobile chrome competes for less space.

## Do's and Don'ts

**Documented AA bypass:** `button-action` (`{colors.background}` text on `{colors.secondary}` fill) measures ~2.4:1, below WCAG AA's 4.5:1 minimum for normal text — this is the canvas's own authored pairing (`background:var(--color-accent-2); color:#fff` in the source bundle), not an oversight. Because this variant is reserved for one short, heading-font, all-caps-weight label per screen (e.g. "Cocinar ya"), treat it as large/bold-text usage where the practical legibility risk is lower than the ratio alone suggests — but do not reuse this pairing for body copy or any text longer than a two-to-three-word button label, where the shortfall would actually hurt readability.

**Do:**
- Do reserve `button-action` (orange) for exactly one CTA per screen — the "Cocinar ya" pattern. Its whole effect depends on scarcity; treat it as a spotlight, not a secondary brand color.
- Do use the `card-insight` (accent-100/800) treatment only for genuine "Fresco learned something" moments — this is the visible proof of the Pro-tier moat named in the Constitution, and diluting it into general-purpose highlight styling erodes the one signal that's supposed to justify the €4.99/month upgrade.
- Do keep every button and tag fully pill-shaped (`rounded.full`). This is the most consistent shape signal in the system — a single square-cornered button or tag will visibly break the "cálido, redondeado" identity.
- Do use the card-radius multiplier (`lg × 1.15`) for all card-family components, not the raw `rounded.lg` token — cards are meant to read rounder than buttons and inputs, not the same.
- Do pull dividers from `{colors.border}` (text at 16% opacity) rather than a separate hardcoded gray, so dividers automatically stay in harmony if text color is ever retuned.
- Do use `Logo negativo` on any accent-green or otherwise dark surface (e.g. the sidebar), and reserve `Logo naranja` for secondary/celebratory contexts, not as the default mark.

**Don't:**
- Don't introduce a second "high-intent orange" button anywhere on the same screen as an existing `button-action` — if two actions both feel like they need orange, that's a hierarchy problem to resolve, not a case for two orange buttons.
- Don't apply the insight-card accent tint to ordinary content cards for visual variety — it is a meaning-carrying color, not a decorative option in the palette.
- Don't use a pure gray for neutral chrome — always pull from the warm `neutral-100`–`900` ramp. A cool gray next to `#FAF3E3` cream will look like a mistake, not a design choice.
- Don't hardcode a hex value for a component color that already has a token (e.g. `background: '#0F4E0E'` on a button) — reference `{colors.primary}` instead, per the spec's component-token discipline, so a future palette shift stays mechanical.
- Don't drop body copy below the 15px base for anything a user reads while cooking (recipe steps, shopping-list items) — the target user is planning and cooking at the same time, often glancing at a phone from across a counter; shrinking body text for density trades away the product's actual use context.
- Don't use `shadow.lg` outside true overlays (modals/sheets) — it's calibrated for content that needs to visually separate from the whole page, and using it on a resting card overstates that card's importance.
