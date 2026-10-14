# Per-Machine Setup — The One-Time Checklist

> Loaded by: whoever sets up a new machine, once.
> **None of this is versionable.** Every item below lives in the app's own settings store on THIS
> computer. There is no repo file that carries it, no CLI command that sets it, and therefore no
> way for `bun sync` or a fresh clone to restore it. That is the reason this file exists: so the
> list is at least written down, even though it cannot be automated.

---

## 1 · Install the binary and confirm the runtime

```bash
command -v orca                                  # the binary
orca status --json </dev/null | jq '.result.runtime'
#   want: state "ready", reachable true; note appVersion before re-checking a gotcha
orca open --json </dev/null                      # if the runtime is not reachable
```

The gate this repo uses is `binary + reachable runtime`, never "is a vendor skill installed"
(`SKILL.md` §The gate). A machine with the binary and no stubs is fully capable.

**Gotcha (Linux)**: outside an Orca-managed terminal the CLI registers as `orca-ide`, because
`/usr/bin/orca` is the GNOME Orca screen reader. Run the gate with `command -v orca-ide` there
and use `orca-ide` for every later command; inside Orca's own terminals `orca` is correct.

Install instructions come from the vendor, not from here. This repo's installer neither installs
nor requires the binary, and nothing in a workflow skill reports its absence (`SKILL.md` §The gate).

---

## 2 · Vendor skill stubs (optional)

```bash
orca skills list                                 # the bundled guide topics
orca skills install --skill orchestration --skill orca-cli --agent universal
orca skills installed
```

These are **optional and never required**. The stubs teach WHEN, not HOW; the grammar is served by
the binary on demand (`orca skills get <topic>`), which is what this repo's references ask for on the DEEP topics; the stubs themselves are loaded, not fetched (`.agents/instructions/agent-skills-and-mcps.md` §5).
Install them if you want the user-level trigger words; skip them and nothing breaks.

Note `orca skills install --local` installs into the current project instead of globally. In THIS
repo, do not use `--local`: a stub landing inside the project skill store would show up as an
untracked skill directory and collide with the repo's own tier model. Global (the default) or
`--agent universal`, and nothing else.

---

## 3 · The two native-launch prerequisites

These two items decide whether **supervision** is available on this machine at all, so they are not
optional extras. The native launch (`worker-start --agent <agent> --model <id> --effort <level>`) is
the ONLY supervised one: the runtime recognizes only agents it started itself, so a terminal created
from our own command line can never be adopted (`references/gotchas.md` G44). A machine that has not
done both items below can still run a fleet, but every worker on it is unsupervised.

### 3.1 · The agent's default arguments (permission mode)

The native path accepts a model and an effort level and **nothing else**: there is no argument
passthrough on `worker-start` or on `worktree create`, so a permission mode cannot be expressed as a
flag. It has to be a per-agent default configured in the app:

1. Open the app's Settings → the Agents section.
2. For the `claude` agent, add `--permission-mode auto` to its default arguments.
3. Leave the run mode per-agent: an agent with its own argument override is excluded from the global
   yolo / manual switch, which is what you want — you do not want a global switch deciding a worker's
   permission model.

Two things to know before relying on it:

- The app's own "yolo" mode injects a FIXED flag per agent, and it is NOT an auto permission mode:
  for `claude` it is the skip-permissions flag, for `codex` the bypass-approvals-and-sandbox flag.
  Those are broader than what a worker needs. The auto-mode classifier belongs to Claude Code, not
  to the runtime, and that classifier is the thing worth keeping alive (gotcha G27).
- For any agent other than `claude`, **consult that agent's own documentation** for its equivalent.
  OpenCode exposes `--auto` (auto-approve permissions not explicitly denied); confirm it with
  `opencode --help` on the machine. For Codex, do not guess a flag — read its docs, then write the
  verified value here.
- **(unverified)** the exact label of the settings section and the field, which may differ per app
  version. Read the screen, do not trust this sentence.

Until that override exists on a machine, a native worker launches in whatever mode the app's
per-agent default gives it, which is the trap gotcha G27 describes. Neither the repo nor a teammate's
machine can tell whether you did it, which is the whole problem with a non-versionable setting.

### 3.2 · Credentials for a supervised worker: each process loads its own config

No harness process holds a `.env` value, whether it is a supervised native launch or a pasted
launch line (ADR-0016): both open the bare harness binary. That does not leave a worker without MCP
credentials: on all three hosts every MCP server that needs `.env` values starts
through the `.env` loader (`bunx -p varlock@<pin> varlock run --no-redact-stdout --inject vars --filter <its vars> -- <server>`,
`.agents/instructions/agent-harnesses.md` §5.5, `MCP_ENV_LOADER_*` in `cli/lib/agent-compatibility-contracts.ts`).
It reads the varlock schema plus `.env` / `.env.local` (or the secret manager the schema names) from
the checkout the harness was launched in, at spawn time, with NO shell involved, and hands each server
only the variables in its filter.

- **Every harness, MCP leg**: the worker's checkout needs its own `.env`. `bun run worktree:provision`
  copies it from the primary checkout; nothing else is derived from it.
- **Plaintext copies from the retired generator** (the `env` block of `.claude/settings.local.json`,
  `.auth/opencode/<VAR>`): no host reads them any more. `bun run harness:env` retires them (a copy equal
  to `.env` is deleted, one `.env` does not reproduce is moved to `.auth/harness-env-backup/` and named),
  and `bun run harness:env:check` exits 1 while one remains.
- **Every worker, any harness, shell leg**: nothing exports `.env` into the worker's shell, on
  purpose: a secret in the shell reaches every tool call the AI makes (Critical Rule #1). The CLIs
  carry their own auth (`acli`, `gh`, `supabase`, `vercel` log in once per machine), the repo's bun
  scripts load `.env` themselves, and any other command that needs a `.env` value (a raw `curl` with a
  token) runs as `bunx varlock run -- sh -c '<cmd using "$VAR">'`, which loads `.env` for that
  process only (G45).

The failure is silent on every leg. A worktree with no `.env`, or a value the schema rejects, leaves
the MCP server without its credential and it dies on its first authenticated call (Critical Rule #9;
`bunx varlock load --agent` shows which value fails, redacted); a CLI that was never logged in on
this machine fails much later with an error that reads like a broken tool.

```bash
bun run worktree:provision                       # a new worktree: copies .env and the other gitignored inputs
bun run harness:env:check                        # exit 1 while a retired plaintext copy remains
bunx varlock load --agent                        # which .env value fails the schema, redacted
bun run setup:doctor                             # reports what this machine declares
```

After a `.env` change nothing needs re-running: restart the agent session, and for OpenCode its
background service too (`opencode service restart`), because it caches the resolved config per
directory.

Two rules that follow from this being per-machine and invisible:

- The conductor **verifies credentials on the worker's screen** before sending it any work
  (`references/coordinator-playbook.md` §1 step 5), whichever surface they came from. Readiness is
  not capability.
- No workflow skill may depend on a shell that exported `.env`. The pasted `launch.txt` line opens
  the bare harness exactly like the native launch, so the human-paste path depends on this section
  too; a shell autoloader is not a supported seam on either path.

---

## 4 · The setup and archive hooks → the committed `orca.yaml`

The repo commits `orca.yaml`: `scripts.setup` runs `bun run worktree:provision` in every new worktree
and `scripts.archive` runs `bun run worktree:audit --rescue` before one is removed
(`references/provisioning.md` §3). Nothing is set per machine, but three per-machine things decide
whether it runs, so read them once:

```bash
orca repo list --json </dev/null
orca repo show --repo <selector> --json </dev/null     # registered hooks + source policy
```

- The source policy in the repository's Hooks settings must not be local-only, or `orca.yaml` is
  ignored. A local script set before `orca.yaml` existed (often `bun install`) is redundant now.
- Approve the trust prompt the first time each hook runs; it asks again when the script changes.
- Keep the setup policy at run-by-default, so a new worktree provisions itself before the agent
  starts.

A machine where the committed hooks cannot run falls back to setting the setup script field in the
app to `bun run worktree:provision` (UI only, gotcha G24) and running the audit by hand before every
removal.

---

## 5 · Mobile pairing (optional)

Pairing a phone is what makes "send me the summary on my phone" real: the board card, its comment
and shared artifacts become readable away from the desk, and a blocking question can be answered
from there. The pairing flow lives in the app plus the environment commands
(`orca environment list` / `orca environment add --pairing-code <code>`); the pairing code itself is
issued by the app. Which controls the phone offers over a blocking question is **(unverified)** —
find out during a real fleet, and record it in `references/gotchas.md`.

---

## 6 · The checklist, to copy

```
[ ] binary installed, `orca status` reports a reachable runtime; appVersion noted
[ ] (optional) vendor stubs installed GLOBALLY, never --local in this repo
[ ] Settings -> Agents: `claude` default args include `--permission-mode auto`
    (prerequisite of the SUPERVISED native launch; a pasted custom-argv line needs nothing)
[ ] other agents: their documented equivalent, verified, not guessed
[ ] a `.env` in every worker checkout (MCP servers read it through the `.env` loader on every host);
    `bun run harness:env:check` exits 0 (no retired plaintext copy left)
[ ] the CLIs a brief calls are logged in on this machine (`acli`, `gh`, `supabase`, `vercel`); a
    command needing a `.env` value runs as `bunx varlock run -- <cmd>` (verify on the worker's
    screen at launch)
[ ] `orca.yaml` hooks honoured: source policy not local-only, trust approved, setup run-by-default
[ ] (optional) phone paired
[ ] a single test worker launched and released end to end BEFORE a real fleet
```

The last line is not decoration. A machine where nobody has ever released a worker is a machine
where the cleanup path is untested, and the cleanup path is the one that takes the runtime down when
it is wrong (gotcha G31).
