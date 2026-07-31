# Review — FRESCO-17

Solo mode: deliberate fresh-eyes review pass, inline, self-adjudicated.

## Findings

1. **Race window between the mount effect and `handleGenerate`'s own `getSession()` read.** `ensureGuestSession()` runs async on mount; `handleGenerate()` independently reads `getSession()` again when the visitor clicks "Generar mi menú". If the anonymous sign-in were still in flight at that exact moment, the request would go out with `null` and hit the existing generic error path.
   - **Verdict: false-positive / accepted risk, not fixed.** The 3-step form takes several seconds of real interaction — far longer than a single auth round-trip (~200-500ms observed live). Guarding this with a promise-ref would add complexity disproportionate to a near-impossible race, and the AC doesn't require it. If it ever fires, the existing error message + retry already covers it.
2. **Pre-existing, unrelated observation (not this story's scope):** the generated `/menu` page rendered a "Fresco aprendió — Menos pimentón picante esta semana… Descartaste el curry picante la semana pasada" insight card for this brand-new anonymous guest with zero prior history. That card appears to be either static/mock content or not properly gated on real per-user learning data (EPIC-FRESCO-5 territory, not FRESCO-17). Flagged to the user in the session wrap-up; not touched here per "don't fix what's out of scope."

## Adjudication

Both findings reviewed against the actual diff + AC. Neither blocks merge.
