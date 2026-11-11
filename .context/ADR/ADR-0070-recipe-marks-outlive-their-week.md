# ADR-0070 — The cocinada and descartada marks of a week outlive that week: they are archived when a plan is deleted

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** Basi Montes (chose option A over a warning-only dialog, in conversation, 2026-11-11; FRESCO-1184, integral review finding C1)
- **Tags:** learning, data-model, retention, cross-cutting-invariant
- **Supersedes:** —
- **Superseded by:** —

---

## Context

The marks that drive the learning loop (`cocinada`, `descartada`) lived only in `meal_plan_recipes.estado`. Deleting a week, or copying a menu over a week that already has one (`copy_meal_plan_to_week` deletes the destination plan first), removed the marks in cascade (`meal_plan_recipes.meal_plan_id ... on delete cascade`). The recipes the person had just marked could return the next week and the history lost weight, against the promise "lo que marcas no vuelve a salir durante 2 semanas" (`components/calendar/learning-bridge-card.tsx`). Three functions read the marks: `get_recent_recipe_marks` (the 2-week no-repeat window), `get_user_cooked_recipe_ids` and `get_user_recipe_engagement` (all-time signals).

## Decision

1. **A table of its own keeps the marks of plans that go.** `recipe_mark_history(user_id, recipe_id, estado, fecha_inicio)`, with `estado` limited to `cocinada` / `descartada` and `fecha_inicio` the Monday of the week the mark was made in (the 2-week window counts from it, like the live marks).
2. **It is filled at the moment a plan is deleted, not whenever a mark is written.** A `before delete` row trigger on `meal_plans` (`archive_recipe_marks_before_plan_delete`, SECURITY DEFINER, `search_path = public, pg_temp`, not executable by any role) copies the plan's decisive marks. Nothing that writes marks changes: while the week exists the live slots stay the source of truth. This covers every way a plan disappears (the user's delete, the overwrite by a copy, the regeneration of a week) with one mechanism.
3. **The three readers read the live marks and the archived ones.** Same signatures, ownership check (`p_user_id = auth.uid()`, ADR-0001) and grants.
4. **The history never outlives the account.** `user_id` references `user_profiles` with `on delete cascade`, and the trigger writes nothing when the profile is already gone (the account-deletion cascade deletes plans after the profile row), so an account deletion neither fails on the history nor leaves rows behind (GDPR art. 17). A deleted catalogue recipe takes its marks with it (`recipe_id ... on delete cascade`).
5. **The table is closed to every client role.** Row level security forced, no policy, no table privilege for `anon` / `authenticated`; `service_role` gets `select` only, so support and the integration tests can see what was archived.

The invariant: **deleting or overwriting a week never makes the app forget what the person cooked or discarded in it.**

## Consequences

- **Positive:** the next menu respects the marks of a deleted week; one trigger covers every deletion path; no writer of marks changed.
- **Negative / trade-offs:**
  - The app remembers `cocinada` / `descartada` for a week the person deleted. That is the point of the decision, and it is erased with the account.
  - The history only grows. A mark is one small row and the all-time engagement signal needs it, so nothing is pruned; revisit if the table ever matters for size.
  - Marks lost before this migration are not recoverable: the history starts with the first plan deleted after it.
- **Neutral / follow-ups:** a mark changed back to `pendiente` on a live slot is simply not archived when the week goes; there is no "unmark" of archived rows because a deleted week can no longer be edited.

## Alternatives considered

- **Only warn in the delete-week dialog.** Rejected by the owner: it is honest but the menu still forgets what was marked, so the closure criterion fails.
- **Write the marks to the history whenever a slot is marked.** Rejected: every writer of `estado` (update-recipe-status, swaps, assignment, retirement) would need to keep two tables coherent, including unmarking. The archive at deletion has one writer.
- **Soft-delete plans.** Rejected: it changes every query over `meal_plans` and keeps far more personal data than the two marks the learning loop needs.

## References

- `supabase/migrations/20261111160000_keep_recipe_marks_after_plan_delete.sql`
- `tests/db/recipe-mark-history.test.ts`
- ADR-0001 (the Free/Pro boundary and the ownership check of the definer functions), ADR-0006, ADR-0008 (learning engine), FRESCO-120, FRESCO-239
