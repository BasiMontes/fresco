# Review — FRESCO-58

Solo mode, self-review (fresh-eyes pass over the diff before commit).

## Diff

- `components/menu/savings-estimate-cards.tsx` (new): 3 static estimate cards + shared placeholder-review disclaimer.
- `app/(app)/menu/page.tsx`: renders the row under `AvailableRecipesCard`, in both branches.

## Real gap found before coding (resolved with the user)

No sourced weekly-spend/savings/time-recovered figures exist anywhere in this repo's business docs (`business/`, `PRD/` — grep came back empty). Rather than invent specific numbers unreviewed, asked the user directly; they chose "propose generic reasonable ranges, marked placeholder-review-needed" — same transparency pattern as the FRESCO-51 legal-draft banner (`bg-warning/10 text-warning text-caption`). The figures shipped (`~45€`/`~15€`/`~3h`) are illustrative placeholders, explicitly flagged in-UI, not validated market numbers — a real founder/business decision still needs to replace them before this reads as a trustworthy claim to users.

## Findings

None legitimate. Considered and dismissed:

- **No unit test.** Same reasoning as FRESCO-56's `CalendarSuggestionBanner`: zero props, zero branching, fixed strings — no logic to unit-test, and no React-render-test harness exists anywhere in this repo. Compensated with live-UI verification.
- **Per-card caption vs one shared disclaimer only?** AC explicitly requires each card to indicate it's an orientative value ("cada una indicando que es un valor orientativo") — kept the per-card "Valor orientativo" caption AND added one shared line below for the separate (not AC-required) placeholder-review flag, rather than conflating the two into one disclaimer.

## Live-UI verification

Ran against the real dev server + the shared QA test account, empty-state branch (no active plan): all three cards render with icon, value, label, and "Valor orientativo" caption; the shared placeholder-review line renders below the row. Screenshot reviewed — no layout defects, consistent card styling with the rest of `/menu`. Happy-path render not independently re-verified live for the same reason as FRESCO-56/57 (test account had no plan at the time) — same component instance in both branches.
