# Review — FRESCO-56

Solo mode, self-review (fresh-eyes pass over the diff before commit).

## Diff

- `components/menu/calendar-suggestion-banner.tsx` (new): static `Card` + `Link` to `/calendar`.
- `app/(app)/menu/page.tsx`: renders the banner above both the empty-state and happy-path branches.

## Findings

None legitimate. Considered and dismissed:

- **Reuse `insight` Card variant instead of `default` + border?** Dismissed — `components/ui/card.tsx` documents `insight` as reserved for a genuine "Fresco learned something" moment, not a decorative CTA. Using `default` + `border-2 border-primary` matches the existing `guest_save_menu_banner` precedent in the same file.
- **Use `action` button variant to match "Cocinar ya"?** Dismissed — DESIGN.md allows only one `action`-variant CTA per screen; `/menu` already spends that slot on "Cocinar ya" (happy path) / the guest save-menu banner (anonymous). Used `secondary` (outline) instead.
- **No new unit test added.** No React-component-rendering test harness exists anywhere in this repo (`fd -e test.tsx` across the whole tree returns zero component tests — every existing test is a pure `lib/`/Edge-Function unit test). Introducing `@testing-library/react` + jsdom for one static, prop-less component would be a disproportionate new dependency for this ticket's scope. Compensated with live-UI verification instead (see compliance matrix).

## Live-UI verification

Ran against the real dev server + the shared QA test account (`.env` credentials), not a production build:

- **Empty state** (test account currently has no active plan): banner renders above `NoMenuEmptyState`, exactly as required by AC Scenario 2 ("el banner siempre está visible... sin importar si ya generó su menú antes").
- **Click-through**: clicking "Ver mi plan semanal" navigates to `/calendar` — AC Scenario 1 confirmed end-to-end.
- **Happy-path render NOT independently re-verified live** — the test account had no plan at the time of this session (a prior session's convention is to delete the test plan after verifying, and no plan existed to regenerate one without a fresh, costed Gemini call). The banner is the exact same component in both branches, placed identically relative to the header — same component instance, not a copy — so the empty-state render is direct evidence for both. Flagged here explicitly rather than silently assumed.

## Gotcha found this session (tooling, not code)

`playwright-cli fill` echoes the literal filled value back in its "Ran Playwright code" log block, even when the value is supplied via shell-expanded env var indirection (`bash -c '... playwright-cli fill e8 "$LOCAL_USER_EMAIL"'`). Piping credentials through env-var substitution does NOT prevent them from surfacing in the CLI's own command-echo output — worth knowing for any future session that treats env-var indirection as a safe channel for secrets into Playwright commands.
