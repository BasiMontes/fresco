# Review — FRESCO-236 (PR #112)

## Adversarial review findings + adjudication

| Severity | Finding | Verdict | Action |
|---|---|---|---|
| BLOCKER | `CreateRecipeForm` edit-mode state desyncs from `receta` prop — persistent mount + one-time `useState` init means cancel-without-save leaves a stale draft for next open, and save-then-reopen shows the pre-edit value (stale closure in `reset()`) | legitimate | fixed — `useEffect` resyncs fields from `receta` whenever `open` becomes `true`, reusing existing `reset()` helper |
| MINOR | `deleteRecetaPropia` treats 0-rows-affected as success (RLS exclusion / already-deleted / wrong id silently no-ops) | legitimate | fixed — added `.select('id')` to delete query, throws `RecipesError` when the returned array is empty |
| NIT | `updateRecetaPropia(client, id, input)` is a 3-positional-param function, against the repo's "max 2 positional" rule | false-positive-for-this-PR | not fixed — matches two pre-existing sibling functions in the same file (`getRecipeDetail`, `getLatestAvailableRecipes`); not a regression introduced by this PR |

No issues found in: RLS/ownership correctness, create-mode regression, dangling-reference data integrity, migration safety, stale doc-comment update, test assertiveness for the API layer.

## Live-UI re-validation (post-fix)

Ran on the running dev server (localhost:3000, real Supabase project) after the fix commit:
- Cancel-then-reopen: filled junk into the name field, cancelled via Escape, reopened edit → field shows the real recipe name, not the junk. Confirms BLOCKER scenario 1 fixed.
- Save-then-reopen: renamed a recipe, saved, reopened edit → field shows the newly saved name, not reverted. Confirms BLOCKER scenario 2 fixed.
- Delete-0-rows fix verified via the new unit test (not re-run live — would require simulating a race, out of scope for manual live-UI pass).

## Verification (post-fix)
- `bun run lint:check` — clean
- `bun run types:check` — clean
- `bun test lib/api/recipes.test.ts` — 41/41 pass
