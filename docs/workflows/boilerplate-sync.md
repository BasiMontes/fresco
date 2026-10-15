# Boilerplate sync: `bun sync` and the ADR reconcile

> FRESCO-958. After a `bun sync`, run `bun run adr:reconcile` so the boilerplate's own ADRs do not collide with this project's decision log.

## Why

`bun sync` delivers the boilerplate's numbered ADRs into `.context/ADR/` with the numbers upstream gave them. Those numbers are already taken by this project's own decisions, so `bun run adr:check` fails on duplicate numbers and on files the README index does not list.

The updater has a rule that keeps them out (`repoOnlyPatterns`), but it applies to an adopted app only. Marking this repo as adopted would also swap the pre-push gates for scoped ones (`tooling:lint:check`, `tooling:types:check`) that judge the synced `cli/` with rules the repo cannot fix durably, so every push would be blocked. `updater.protected_paths` does not help either: it stops an overwrite and still delivers a file that is missing.

## The flow

1. `bun sync` (preview with `bun sync --dry-run`).
2. `bun run adr:reconcile` prints a plan and writes nothing.
3. `bun run adr:reconcile -- --yes` applies it.
4. `bun run adr:check` must pass.
5. Commit the result with the sync.

## What the reconcile does

An incoming ADR is a file in `.context/ADR/` that the README index does not list. For each one:

| Case                                                    | Action                                                                                                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The same slug is already indexed                        | The incoming file is dropped. The report says whether the imported text still differs from ours; a difference means upstream amended it, so compare it with upstream.   |
| New, and its number is free                             | The file stays as it is and gets an index row.                                                                                                                          |
| New, and its number is taken                            | It moves to the next free number. The title and every citation to a renumbered ADR are rewritten, an `Upstream number` line is added, and an index row is inserted.      |

Citations between imported ADRs are rewritten through one map, so a batch stays consistent. A citation the map does not know is reported, because it would resolve to one of our own ADRs.

## Reading an upstream citation

Synced files, such as the instruction sections and the skills, keep citing upstream numbers. The `Upstream numbers` table in `.context/ADR/README.md` maps each one to ours. The script maintains it between the `upstream-adr-map` markers, from the `Upstream number` lines and from the rows already there. A decision merged by hand into an existing ADR has no such line, so its row is written once in the table.

## Limits

- `bun sync --dry-run` still lists the upstream ADRs as files it would apply. The reconcile runs after a real sync, not before.
- The durable fix is an updater option that lets a project declare paths it never receives. Until upstream offers one, this step stays manual.
