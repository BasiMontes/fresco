---
version: beta
name: Fresco
description: Menús semanales con IA que aprende de lo que realmente cocinas. Warm cream-and-clay editorial system pairing corporate green with corporate orange for Spain's household meal planners. v2 (FRESCO-436) — calm editorial direction, Fraunces display, one-accent discipline, hairline-first surfaces.
colors:
  primary: '#0F4E0E'
  secondary: '#DF8C26'
  tertiary: '#6F5F43' # FRESCO-299: darkened from #847456 for WCAG AA as text-tertiary body copy (~4,9:1 on surface, ~5,6:1 on background); the neutral-600 ramp step below keeps #847456
  neutral: '#A39372'
  background: '#FAF3E3'
  surface: '#F1E3C6'
  surface-raised: '#FBF6EC' # v2 (FRESCO-437): a near-white warm cream, one step LIGHTER than background — the card surface, so cards lift off the page instead of the old surface-on-background beige-on-beige (~4% contrast). Paired with a mandatory hairline border on every card (see §Elevation & Depth).
  text: '#201E1D'
  border: 'color-mix(in srgb, #201E1D 16%, transparent)'
  success: '#0F4E0E'
  warning: '#DF8C26'
  error: '#B03D2B' # FRESCO-293: darkened from #B8422E (4,29:1 on surface, below WCAG AA) to #B03D2B (~4,66:1 on surface, ~5,92:1 white-on-token)
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
  # v2 (FRESCO-437): display face is Fraunces (variable), applied to h1/h2 ONLY.
  # h3–h6, card titles, and button labels are Figtree. See §Typography for the role rule.
  h1:
    fontFamily: Fraunces
    fontSize: 44px
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: -0.025em
  h2:
    fontFamily: Fraunces
    fontSize: 32px
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: -0.02em
  display-light:
    fontFamily: Fraunces
    fontSize: 28px
    fontWeight: 300
    lineHeight: 1.15
    letterSpacing: -0.015em
  h3:
    fontFamily: Figtree
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  h4:
    fontFamily: Figtree
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.005em
  h5:
    fontFamily: Figtree
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.3
  h6:
    fontFamily: Figtree
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.2
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
  # v2 (FRESCO-437, option A): roundness dialled back from the v1 "very round" scale toward an
  # editorial read. Pills KEPT on buttons and tags (the system's strongest brand-shape signal).
  sm: 6px
  md: 12px
  lg: 16px
  image: 16px # v2: recipe/photo image areas
  card: 20px # v2: down from 32px
  full: 999px
spacing:
  1: 4.4px
  2: 8.8px
  3: 13.2px
  4: 17.6px
  6: 26.4px
  8: 35.2px
  12: 52.8px # v2 (FRESCO-437): page-level rhythm — gap between minor sections
  16: 70.4px # v2: gap between major content blocks
  24: 105.6px # v2: hero / page-top breathing room
motion:
  # v2 (FRESCO-437): motion values are NOT redefined here. The system already
  # has a full vocabulary in `app/globals.css` :root — `--duration-*`,
  # `--ease-*`, `--distance-*`, `--scale-*` plus per-interaction tokens —
  # installed by transitions-dev (FRESCO-247). DESIGN.md v2 sets the *intent*,
  # not new numbers. See prose §Motion. FRESCO-446 applies it.
  source: 'app/globals.css :root (transitions-dev / FRESCO-247)'
  intent: 'calm — prefer the shorter durations (--duration-quick 150ms / --duration-fast 250ms) and --ease-smooth-out; treat the --ease-bounce* curves as legacy (keep what ships, add no new overshoot)'
  reduced-motion: 'Honour prefers-reduced-motion: reduce — already wired app-wide (FRESCO-244); drop non-essential animation, keep short opacity fades'
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
    backgroundColor: '{colors.surface-raised}' # v2: lighter than background, not darker
    borderColor: '{colors.border}' # v2: hairline on every card, always
    rounded: '{rounded.card}'
    padding: '{spacing.3}'
  card-insight:
    backgroundColor: '{colors.accent-100}'
    textColor: '{colors.accent-800}'
    rounded: '{rounded.card}'
    padding: '{spacing.3}'
  card-pro:
    backgroundColor: '{colors.surface-raised}' # v2
    rounded: '{rounded.card}'
    padding: '{spacing.3}'
  recipe-card:
    backgroundColor: '{colors.surface-raised}' # v2
    borderColor: '{colors.border}' # v2
    typography: '{typography.h5}'
    rounded: '{rounded.card}'
    padding: '{spacing.3}'
  tag:
    # v2 (FRESCO-437): default tag is hairline, no colour fill. Colour returns only for the
    # allergen-safety flag (tag-allergen) — see §Components + §Do's and Don'ts.
    typography: '{typography.caption}'
    textColor: '{colors.tertiary}'
    borderColor: '{colors.border}'
    rounded: '{rounded.full}'
    paddingX: '{spacing.2}'
    paddingY: '{spacing.1}'
  tag-selected:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.background}'
    rounded: '{rounded.full}'
  tag-outline:
    textColor: '{colors.primary}'
    borderColor: '{colors.primary}'
    rounded: '{rounded.full}'
  tag-allergen:
    # v2: the ONE tag that keeps a colour fill — allergen / dietary-restriction flags must
    # stand out for food-safety reasons. Warm amber tint, dark text (WCAG AA).
    backgroundColor: '{colors.accent-2-100}'
    textColor: '{colors.accent-2-800}'
    rounded: '{rounded.full}'
  nav-sidebar:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.background}'
  nav-bottom-tab:
    backgroundColor: '{colors.background}'
    textColor: '{colors.primary}'
  icon:
    textColor: '{colors.primary}'
    size: 24px
    strokeWidth: 2
---

## Tesis

> **Fresco es un ritual semanal, no una app. Decides una vez y te olvidas — y cada semana acierta más porque aprende de lo que cocinas de verdad.**

This one sentence governs every visual decision in the system (FRESCO-436 redesign). Read it before choosing a size, a weight, a motion curve, or a word of UI copy.

What it means in practice:

- **Calm over busy.** Large but *light* headlines (Fraunces at weight 400, never bold), generous whitespace, few visible controls per screen. The posture of a printed weekly planner, not a dashboard.
- **The photo leads.** The interface stays close to monochrome — warm cream, structural green, one accent — so the food supplies the colour. A recipe grid should read as photography with captions, not as chrome with thumbnails.
- **Restraint is the premium signal.** Authority comes from the calm of a 400-weight headline at 44px and a hairline rule, not from heavier weights, coloured fills, or drop shadows bolted on.
- **Unhurried motion.** Nothing bounces. Transitions are short, eased, and quiet (see §Motion).
- **The learning is the payoff.** The one place the system raises its voice is the `card-insight` — "I adjusted this for you." That scarcity is the point.

The north-star references for this direction are two editorial product sites (Houseplant, Sweetgreen): cream canvas, near-monochrome UI, photography-forward, hairline-first, big calm type. Fresco keeps its own palette (green + orange) and its own thesis; it borrows the *posture*, not the look.

## Overview

Fresco is a Spain-focused weekly meal-planning app for **Laura, the exhausted planner** — a 30–40-year-old who cooks five-plus days a week and hits the same recurring wall every Sunday afternoon: "what do I cook this week?" (`.context/business/business-model.md`, `.context/PRD/user-personas.md`). The product's entire pitch is that it gets easier the more you use it, because it learns from what your household actually cooks, not from a preference form you filled out once. A design system for that promise cannot look like a cold utility tool — it has to feel like the difference between a spreadsheet and a kitchen counter.

The visual theme, in the founder's own words from the brand canvas, is direct: **"Cálido, redondeado, verde + naranja"** — warm, rounded, green + orange (`design/handoff/fresco/brand-guide.dc.html`). The brand tagline frames the product identity end to end: *"Menús semanales con IA que aprende de lo que realmente cocinas"* (Weekly menus with AI that learns from what you actually cook). Every token in this system exists to make that tagline felt on first paint, not just claimed in copy.

Concretely: a warm cream background (`#FAF3E3`) instead of clinical white, a hand-picked corporate green (`#0F4E0E`) for trust and primary action, and a corporate orange (`#DF8C26`) reserved for the single highest-intent moment on a screen. Corners are soft but not bouncy — **v2 (FRESCO-436)** dialled the card/panel radii back toward an editorial read while keeping buttons and tags as full pills (the brand-shape signal); see §Shapes. This system was originally authored in Claude Design (`claude.ai/design`) and exported as a brand-guide canvas; **v1** of this file wrapped those tokens verbatim. **v2** is the first deliberate departure — a calm editorial direction (Fraunces display, one-accent discipline, hairline-first surfaces, an unhurried motion intent over the existing transitions-dev tokens) ratified screen-by-screen under epic FRESCO-436. Where a value now differs from the `design/handoff/fresco/brand-guide.dc.html` canvas, the change is annotated inline with its ticket.

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
- **Surface — `#F1E3C6` (crema superficie):** one step *darker* than background. v1 used this for cards; v2 keeps it only for **inputs, segmented controls, and inset panels** (recessed elements that should read as "pressed into" the page).
- **Surface-raised — `#FBF6EC` (crema clara):** v2 (FRESCO-437). One step *lighter* than background — a near-white warm cream. This is the **card surface**. Cards now lift *up* off the cream page instead of sitting one shade down into it, which is what made the v1 UI read as "beige on beige" (background→surface was only ~4% contrast). Always paired with a hairline border (see §Elevation & Depth).
- **Text — `#201E1D`:** near-black, warm-toned rather than pure `#000`, kept soft in the same family as the rest of the palette.
- **Border/Divider:** `color-mix(in srgb, #201E1D 16%, transparent)` — text color at 16% opacity rather than a separate hardcoded gray. Guarantees dividers always sit in visual harmony with body text regardless of future text-color tuning.
- **Success — `#0F4E0E`:** reuses primary. The brand canvas defines no separate success color, and inventing one would fragment a two-hue system; "success" and "trust" are the same signal in this product (a generated menu succeeding *is* the primary action).
- **Warning — `#DF8C26`:** reuses secondary/accent-2. Dietary-flag tags (e.g. "Sin gluten") use accent-2 tinted backgrounds — warmth as attention, not alarm.
- **Error — `#B03D2B`:** the one token in this file with no direct source in the brand canvas (the canvas defines no destructive/error color). Chosen as a warm clay-red in the same desaturated family as the rest of the palette rather than a stock saturated red, so a validation error never looks like it belongs to a different app. Flagged here per the spec's conflict-resolution discipline (§8 `llm-authored.md`) — this is the one extension beyond the bundle, not a silent override. FRESCO-293: darkened from the original `#B8422E`, which measured 4,29:1 as error text on the `#F1E3C6` cream surface — below the WCAG AA 4,5:1 threshold for normal text. `#B03D2B` measures ≈4,66:1 on cream and ≈5,92:1 for white text on the token itself (destructive buttons), clearing WCAG AA 4,5:1 for both uses while staying in the same warm-clay family. Darkened as the single global token — there is one error red for the whole system, no local overrides.
- **Neutral scale (100–900):** warm/cream-toned, *not* pure gray (`#FBF6EC` → `#2F281C`). Backs the tag-neutral component and any chrome that needs to recede without going cold.
- **Accent / Accent-2 100–900 ramps:** in the source canvas these are authored as CSS `color-mix(in oklch, white/black N%, <base> N%)` expressions around the 500 base (100–400 mixed toward white, 600–900 toward black). The DESIGN.md spec's `Color` type is hex-sRGB only (§3 of the spec card), so the frontmatter above stores each step as the exact flattened hex the browser would compute from that same `color-mix()` formula (OKLCH-space interpolation, matching CSS Color 4 semantics) — same color, valid token type, zero drift from the canvas. `design/handoff/fresco/brand-guide.dc.html` remains the reference if the live `color-mix()` expressions are ever needed for a CSS export target. Ramp usage: tinted surfaces (100), the insight-card treatment (100 background / 800 text), and the allergen tag.

### Color discipline (v2 — one accent, one job)

The palette does not change. What changes is how tightly it is applied. Per the thesis, the UI stays close to monochrome so the **food photography supplies the colour**.

- **Green is structural.** Text, nav, active states, focus, icons, primary buttons. It is not decoration.
- **Orange is a spotlight, one per screen.** The single highest-intent CTA (`button-action` — "Generar mi menú"), the allergen tag, the calendar "today" pill. Nothing else. Its rarity is the whole effect.
- **No decorative accent.** v2 retires every ornamental use of orange the v1 UI accumulated: doodles, section flourishes, underlines, tinted-for-variety icons. If an orange element is not the primary CTA or a safety flag, it goes.
- **Tags lose their fills.** v1 had `tag-accent` / `tag-accent-2` / `tag-neutral` — three coloured tint variants competing on every card. v2 collapses them to one hairline `tag` (no fill). The lone exception is `tag-allergen` (amber tint), which keeps colour for food-safety visibility.
- **Photography is the colour budget.** Terracotta, olive, ceramic, char — those come from the dish, on a near-neutral UI. See FRESCO-447 (photo grade) for keeping that consistent.

## Typography

Two families, strictly paired — one display, one body. **v2 (FRESCO-437)** replaced the v1 display face (Caprasimo, a rounded novelty slab that was applied to every heading level, every card title, and every button label — which flattened hierarchy and cheapened the system) with a calm editorial serif used only where it earns its place.

- **Display — Fraunces** (variable; weights 300 and 400 in use): an old-style serif with real optical sizing and a `WONK`/`SOFT` axis, giving it a bespoke character without a licence fee. Used at weight **400** for `h1`/`h2` and at weight **300** (`display-light`) for the occasional editorial subhead. Never bold — per the thesis, authority comes from calm, not weight. Tracking is negative and tightens with size (`-0.025em` at `h1`, `-0.02em` at `h2`). Fallback stack: `Fraunces, Georgia, "Times New Roman", serif`.
- **Body — Figtree** (weights 400/600): the workhorse. Everything that is read quickly and often — recipe steps, shopping-list items, form labels, meta lines — **plus** `h3`–`h6`, card titles, and every button label. Fallback stack: `Figtree, -apple-system, BlinkMacSystemFont, sans-serif`.

**The role rule (v2):** Fraunces appears on `h1` and `h2` ONLY. `h3`–`h6` are Figtree 600. Card titles (including recipe cards) are Figtree, capped at 2 lines (`line-clamp: 2`) so the title never competes with the photo. Button labels are Figtree 600. If a heading is not a page-level or section-level headline, it is Figtree.

- **Scale:** `h1` 44px / `h2` 32px (Fraunces) → `h3` 22px … `h6` 12px (Figtree; `h6` is uppercase, `0.08em` tracking — a kicker/label, e.g. "Fresco aprendió", not a headline).
- **Body:** 15px base, line-height `1.55` — generous enough for recipe instructions read at arm's length in a kitchen. Never below 15px for anything read while cooking.

## Layout

Base spacing unit is **4.4px**, not a round 4px or 8px — preserved exactly as authored on the canvas rather than rounded to a "cleaner" number, because the scale was tuned as a system (`space-1` through `space-8` all derive from the same 4.4px unit: 4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2). Treat this as a fixed multiplier, not six independent values — if a new step is needed (e.g. `space-5`), derive it as `4.4px × n`, don't interpolate visually.

Spacing usage convention observed in the canvas: `space-2` for tight internal gaps (card content stacking), `space-3` for card padding and button horizontal padding, `space-4` for section dividers (`.hr` margin).

**Page-level rhythm (v2 — FRESCO-437).** v1 topped out at `space-8` (≈35px), which left every page feeling evenly-packed with no breathing room between major blocks — part of why the UI read as "flat" and cramped. v2 adds three larger steps on the same 4.4px multiplier, reserved for page structure, not component internals:

- `space-12` (≈53px) — gap between minor sections within a page.
- `space-16` (≈70px) — gap between major content blocks (e.g. the stat row and the meal grid on `/menu`).
- `space-24` (≈106px) — page-top / hero breathing room, and the gap before a page-closing block.

No container max-width or grid-column convention is defined in the source bundle — inherit standard responsive breakpoints from the frontend framework rather than inventing one here.

## Elevation & Depth

**Hairline first (v2 — FRESCO-437).** Separation between a card and the page comes primarily from a **1px hairline border** (`{colors.border}` — text at 16% opacity) plus the lighter `surface-raised` fill, *then* a soft shadow. This is the editorial read from the north-star references: flat surfaces with hairline rules, one quiet shadow, never a heavy drop-shadow. Every card carries the hairline unconditionally — it is not optional, and it is what guarantees a card is always visibly distinct from the cream page even where the shadow is imperceptible.

Three shadow levels, all computed against the same warm dark base (`#2F281C`, the darkest neutral) rather than pure black — shadows stay in the same warm family as everything else.

- **sm** — `0 1px 2px` at 14% opacity of `#2F281C`. Default resting elevation for standard cards, on top of the hairline.
- **md** — `0 3px 10px` at 16% opacity of `#2F281C`. Cards that claim attention without being modal-level — the insight card and the Pro-plan card.
- **lg** — `0 12px 32px` at 22% opacity of `#2F281C`. True overlays only (modals, sheets).

Z-index layer convention (not sourced from the canvas, standard default): base `0`, dropdown `100`, modal `1000`, toast `10000`.

## Shapes

**v2 (FRESCO-437, option A) — roundness dialled back.** v1 was very round (card ≈32px, `lg` 28px), which read as "bouncy" against the calm editorial direction. v2 tightens the card/panel radii toward an editorial read **while keeping pills on buttons and tags** — the pill is the system's strongest brand-shape signal and "redondeado" is in the founder's brief, so it stays. This is a deliberate brand-vs-trend call, ratified with the founder (option A over the more aggressive "kill the pills" option B).

- **sm — 6px:** small chip-like elements, checkboxes, swatch previews.
- **md — 12px:** segmented controls, form-field groupings, inset panels.
- **lg — 16px:** general containers, dropdown menus.
- **image — 16px:** recipe / photo image areas (inside recipe cards, recipe detail hero).
- **card — 20px:** full card components (base card, insight card, Pro card, recipe card). Down from ≈32px. Still soft, no longer "a soft object on a counter" — an editorial card.
- **full — 999px:** true pills. **Every button and every tag stays fully pill-shaped, no exceptions** — the one roundness signal v2 preserves intact (see Do's and Don'ts).

## Motion

**v2 (FRESCO-437) — intent, not new tokens.** The system already has a complete motion vocabulary: `app/globals.css` `:root` defines `--duration-*` (`stagger` 40ms … `very-slow` 500ms), `--ease-*` (`smooth-out`, `in-out`, `out`, `linear`, `bounce`, `bounce-strong`), `--distance-*`, `--scale-*`, `--blur-*`, plus dozens of per-interaction tokens — all installed by transitions-dev (FRESCO-247) and consumed across the app. `prefers-reduced-motion` is already wired app-wide (FRESCO-244). v2 does **not** redefine any of this; it sets how the thesis ("unhurried") picks from it.

- **Prefer the calm end of the scale.** Default to `--duration-quick` (150ms) and `--duration-fast` (250ms); reserve `--duration-slow`/`--duration-very-slow` for genuine page- or panel-level moments. `--ease-smooth-out` is the house curve.
- **The `--ease-bounce` / `--ease-bounce-strong` curves are legacy.** They ship on the like-button burst, the notification-badge pop and the avatar-group hover — keep those. Add **no new** overshoot or spring: a new transition uses `--ease-smooth-out`, `--ease-in-out`, or `--ease-out`.
- **Reduced motion.** Already honoured everywhere via FRESCO-244 — drop non-essential animation (reveals, slides, parallax), keep short opacity fades. New motion must respect the same guard.
- **What gets motion (v2 additions, FRESCO-446).** Landing: gentle section reveals on scroll. App: the existing hover/press, dropdown/sheet, tab and page transitions stay; add a quiet entrance for the `card-insight`. Not: decorative loops, attention pulses, or anything on the path of reading a recipe.

## Components

**Buttons** — Figtree 600 label (v2: was the display face), always pill-shaped (`rounded.full`):
- `button` (primary): filled `{colors.primary}`, `{colors.background}`-colored text. Default action.
- `button-action`: filled `{colors.secondary}` (orange), `{colors.text}` (near-black) label — dark text on the light-ish amber is the accessible pairing (~6,3:1; FRESCO-283 replaced the original cream-on-amber, which measured ~2,4:1). Hover lightens to `accent-2-400` rather than darkening, so the dark label keeps its contrast on hover. Reserved for the single highest-intent CTA on a screen — observed usage: "Generar mi menú" (Generate my menu), a lightning-bolt-flagged action distinct from every other button on the same screen.
- `button-secondary`: outlined, `{colors.border}`-colored border, transparent fill.
- `button-ghost`: text-only, `{colors.primary}` text, no border or fill.
- `button-icon`: 36×36 circular, used for compact actions (e.g. the favorite/heart toggle on a recipe card).

**Tags/pills** — small pill badges, `rounded.full`, 11px text. **v2 (FRESCO-437): hairline by default, colour only for safety.**
- `tag` (default): hairline `{colors.border}`, `{colors.tertiary}` text, no fill. Every dietary/attribute flag ("Sin gluten", "Vegano", "Healthy") uses this.
- `tag-selected`: filled `{colors.primary}`, background-colored text — the "this one is chosen" state (e.g. a selected filter chip).
- `tag-outline`: `{colors.primary}` border and text — the unselected counterpart of `tag-selected`.
- `tag-allergen`: the ONE tag that keeps a colour fill — `{colors.accent-2-100}` amber tint, `{colors.accent-2-800}` text. Allergen and hard-restriction flags ("Frutos secos", "Contiene lactosa") must stand out for food-safety reasons; this is a meaning-carrying exception, not a decorative option. v1's `tag-accent` / `tag-accent-2` / `tag-neutral` tint variants are retired — do not reintroduce coloured tags for visual variety.

**Form fields (v2 — FRESCO-443 owns the full pass; contract here):**
- `input`: pill-shaped (`rounded.full`), `{colors.surface}` background, `{colors.border}` outline **at rest**, and a visible **focus ring** in `{colors.primary}` on focus (v1 had no designed focus state). Placeholder text at `{colors.tertiary}`, not lighter — it must read as an active field, never disabled. Text fields never sit directly on page background.
- `segmented-control`: a radio-style pill group (`rounded.md`, not full). Checked option → filled `{colors.primary}` background; unchecked stay transparent in the shared outlined container.
- Ghost/secondary buttons on a form (e.g. "Guardar") never render as `surface`-on-`surface` — that reads as disabled. Use `button` (primary green) for the real action and `button-ghost` for the escape hatch.

**Cards** — all use `rounded.card` (20px, v2), `surface-raised` fill, and an unconditional `{colors.border}` hairline:
- `card` (base): `surface-raised` background, hairline border, `shadow.sm`. Generic content container. The hairline is what keeps it distinct from the cream page.
- `card-insight`: `{colors.accent-100}` tinted background, `{colors.accent-800}` text, `shadow.md`. The behavioural-learning-moat callout — "Fresco aprendió — menos pimentón picante". Its accent tint is what makes the learning feel like a celebrated event, and it is the one place in v2 the near-monochrome UI deliberately raises its voice. Unchanged from v1 — this token is reserved and meaning-carrying.
- `card-pro`: `surface-raised` background with a 2px `{colors.primary}` border, `shadow.md`.
- `recipe-card`: **v2 direction (FRESCO-441 owns the redesign; contract here):** the photo leads — a full-width image area at the top (`rounded.image`, `object-fit: cover`, consistent aspect ratio per FRESCO-447), title below in Figtree capped at 2 lines, meta and a single tag as secondary info, favourite `button-icon` top-right over the photo. The no-photo state is a designed placeholder (subtle monochrome gradient keyed to meal category, or a typographic initial) — never a lone line-icon on beige. Same component and element order on `/menu`, `/calendar`, `/recipes`.

**Icons** — a minimal 2px-stroke line set, always `{colors.primary}`: home, calendar, recipes (open book), shopping list, profile, save/heart, add (calendar+plus), notifications (bell), "cook now" (lightning bolt), and a 6-dot drag handle. Single stroke weight and single color across the entire set — no per-icon color exceptions, matching the canvas original. FRESCO-85/86/87 unified icon-button glyph *size* (24px / 22px variants), not stroke width — this file previously misattributed a 3px stroke bump to those tickets; the shipped nav/UI icon set (`components/layout/sidebar.tsx`, `bottom-tab-bar.tsx`, etc.) stays at 2px, carried explicitly by the `components.icon.strokeWidth` token (FRESCO-298 removed a stray global `svg.lucide { stroke-width: 3 }` CSS rule that had been overriding it app-wide). A separate, narrower 3px stroke is used only for small (≤16px) checkmarks (`components/ui/checkbox.tsx`, success ticks) where a thicker relative stroke is needed for legibility at that size — that is a distinct, size-driven exception, not a system-wide icon weight.

**Navigation** — one destination set (Home/Menu, Calendar, Recipes, Profile) surfaced two ways:
- `nav-sidebar` (desktop): `{colors.primary}` background, active item highlighted with a pill (`rounded.full`) in white/cream — FRESCO-70 moved this off the dark `accent-900` end of the ramp onto the primary brand green itself, the one surface in the system where `primary` becomes a background rather than just a text/icon/border color. Use the `Logo negativo` lockup here, never the base logo — still clears WCAG AA (~9.9:1) against `#0F4E0E`.
- `nav-bottom-tab` (mobile): background background-colored, `{colors.primary}` icons, dot-indicator active state rather than a pill or background fill — kept lighter-weight than the sidebar because mobile chrome competes for less space.

## Do's and Don'ts

**Amber (`{colors.secondary}` / `accent-2`) contrast rule (FRESCO-283):** the source canvas authored amber CTAs as cream-on-amber (`color:#fff` on `background:var(--color-accent-2)`), which measures ~2,4:1 — below WCAG AA. That "documented bypass" was retired. The rule now:

- **Amber as a fill** (buttons, badges, the "Popular" pill, the calendar "today" pill, step-number circles): pair with `{colors.text}` (near-black), never cream/white. `{colors.text}` on `{colors.secondary}` ≈ 6,3:1. The `{colors.secondary}` hex is unchanged — only the text on top flips.
- **Amber as text or an icon on the cream/surface canvas** (the `<h1>` accent "súper.", the "MENÚ SEMANAL CON IA" eyebrow, the impact-stats "." accent): use `accent-2-700` (`#8A5513`), not `{colors.secondary}` — `accent-2-500` as a foreground on cream is only ~2,4:1; `accent-2-700` is ~5,6:1.
- Decorative-only amber (aria-hidden icons, the hero device-mockup illustration, tinted `accent-2-100` backgrounds behind dark text) is exempt.

The vibrant `#DF8C26` stays the brand color everywhere it is a surface; it just never carries light text and is never itself small body text on the page canvas.

**Do (v2 — FRESCO-437):**
- Do use **Fraunces on `h1`/`h2` only.** Every other heading, every card title, every button label is Figtree. A card title in the display face pisa the photo and flattens hierarchy — that was the v1 mistake.
- Do give **every card a hairline border** (`{colors.border}`), unconditionally, on top of `surface-raised`. The hairline is the guarantee a card never disappears into the cream page.
- Do keep headlines at **weight 400** (or 300 for `display-light`). Never bold a Fraunces headline — authority comes from calm and scale, not weight.
- Do pull motion values from the existing `--duration-*` / `--ease-*` tokens in `globals.css` (transitions-dev / FRESCO-247), preferring the calm end. No hardcoded `300ms ease-in-out`; add no new spring/overshoot curve.
- Do use the page-rhythm steps (`space-12/16/24`) between major blocks — the v1 scale stopped at `space-8` and everything felt packed.

**Do:**
- Do reserve `button-action` (orange) for exactly one CTA per screen — the "Generar mi menú" pattern. Its whole effect depends on scarcity; treat it as a spotlight, not a secondary brand color.
- Do use the `card-insight` (accent-100/800) treatment only for genuine "Fresco learned something" moments — this is the visible proof of the Pro-tier moat named in the Constitution, and diluting it into general-purpose highlight styling erodes the one signal that's supposed to justify the €4.99/month upgrade.
- Do keep every button and tag fully pill-shaped (`rounded.full`). This is the most consistent shape signal in the system — a single square-cornered button or tag will visibly break the "cálido, redondeado" identity.
- Do use the card-radius multiplier (`lg × 1.15`) for all card-family components, not the raw `rounded.lg` token — cards are meant to read rounder than buttons and inputs, not the same.
- Do pull dividers from `{colors.border}` (text at 16% opacity) rather than a separate hardcoded gray, so dividers automatically stay in harmony if text color is ever retuned.
- Do use `Logo negativo` on any accent-green or otherwise dark surface (e.g. the sidebar), and reserve `Logo naranja` for secondary/celebratory contexts, not as the default mark.

**Don't (v2 — FRESCO-437):**
- Don't use orange for decoration — no doodles, section flourishes, underlines, or tinted-for-variety icons. Orange is the primary CTA, the allergen tag, and the calendar "today" pill. Nothing else.
- Don't reintroduce coloured tag fills (`tag-accent` / `tag-neutral` are gone). Tags are hairline; `tag-allergen` is the only coloured one.
- Don't put a card on the darker `surface` — that is for recessed elements (inputs, segmented controls). Cards go on the lighter `surface-raised`.
- Don't render a form's real action button as `surface`-on-`surface` (the v1 "Guardar" bug) — it reads as disabled.
- Don't animate longer than `duration-slow` (320ms), and don't use bounce/spring easing anywhere.
- Don't square-corner a button or a tag — pills are the one roundness signal v2 keeps (option A).

**Don't:**
- Don't introduce a second "high-intent orange" button anywhere on the same screen as an existing `button-action` — if two actions both feel like they need orange, that's a hierarchy problem to resolve, not a case for two orange buttons.
- Don't apply the insight-card accent tint to ordinary content cards for visual variety — it is a meaning-carrying color, not a decorative option in the palette.
- Don't use a pure gray for neutral chrome — always pull from the warm `neutral-100`–`900` ramp. A cool gray next to `#FAF3E3` cream will look like a mistake, not a design choice.
- Don't hardcode a hex value for a component color that already has a token (e.g. `background: '#0F4E0E'` on a button) — reference `{colors.primary}` instead, per the spec's component-token discipline, so a future palette shift stays mechanical.
- Don't drop body copy below the 15px base for anything a user reads while cooking (recipe steps, shopping-list items) — the target user is planning and cooking at the same time, often glancing at a phone from across a counter; shrinking body text for density trades away the product's actual use context.
- Don't use `shadow.lg` outside true overlays (modals/sheets) — it's calibrated for content that needs to visually separate from the whole page, and using it on a resting card overstates that card's importance.
