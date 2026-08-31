# pi-agentic

Optional agentic layer for [pi](https://pi.dev): agent role definitions,
explicit workflow entry points, and the orchestration package setup.

This repository is a **companion to `pi-setup`** (see `../pi-setup`), not a
replacement:

- `pi-setup` is the stable base: reusable skills and general-purpose
  extensions, installed by default.
- `pi-agentic` is the opt-in agentic layer: agent definitions, explicit
  workflows, and the orchestration package. Installing it does not modify
  `pi-setup`, and skills in `pi-setup` never delegate to agents.

The separation rule, enforced by layout and setup behavior:

- **Skills** are for direct, non-agentic execution in the active session.
- **Workflows** are the explicit entry point for delegation — they only run
  when you invoke them with their `/command`.
- **Agents** are implementation roles used by workflows.
- Optional orchestration packages are never base-setup dependencies.

## Prerequisites

- [pi](https://pi.dev) (`pi` on PATH)
- tmux >= 3.5 (only needed for `pane: true` agents; bg agents work without it)
- The orchestration package `@vanillagreen/pi-agents-tmux` (installed by the
  setup script; override with `PI_GRAPH_PACKAGE`)

## Install

```bash
cd ~/development/pi-agentic
./scripts/setup.sh
```

The script is idempotent and safe to re-run. It:

1. Runs `pi install` on the orchestration package
   (`@vanillagreen/pi-agents-tmux` by default — see `COMPATIBILITY.md` for
   why this replaces the historical `pi-graph`).
2. Registers this repository as a pi package, which exposes `workflows/` as
   prompt templates (`/command`).
3. Symlinks each `agents/*.md` file into `~/.pi/agent/agents/` — the
   user-scope agent directory. Existing non-symlink files are never
   overwritten; stale links owned by this repo are removed.

It never installs or modifies `pi-setup`.

After running: restart pi (or `/reload`) so the workflow prompt templates
load. Agents are discovered fresh on each subagent invocation — no reload
needed for agent edits.

## Invoke a workflow

Workflows are prompt templates. Type `/` in the pi editor to see them:

- `/scout-and-plan <task>` — scout gathers context, planner creates an
  implementation plan. No implementation.

Nothing runs unless you explicitly invoke a workflow. A normal skill (e.g.
`/frontend-tip`) remains a direct active-session operation.

## How agents are linked

Each `agents/<name>.md` is symlinked individually into
`~/.pi/agent/agents/<name>.md`. The orchestration package discovers them
(user scope) on every subagent call. Edits to files in this repo take effect
immediately — the link points at the source file.

## Remove

```bash
./scripts/setup.sh --remove
```

Removes agent symlinks owned by this repository and uninstalls the two
package registrations. It never touches unrelated agents, packages, or
settings entries.

## Model policy

Models are assigned per agent in frontmatter (`model:` +
`model-reasoning-effort:`). Current policy: `opencode-go/glm-5.3-flash` for
all roles except planning and review (`planner`, `reviewer`), which use
`opencode-go/gpt-5.6-luna`. Workflows never switch the active parent
session's model.

## Compatibility

See [COMPATIBILITY.md](COMPATIBILITY.md) for the verified contracts: pi
version, orchestration package source, agent discovery paths, workflow
format, and the historical-inventory triage.

## Security

Installing the orchestration package means installing an extension with full
system access, and workflows instruct the model to dispatch subagents that
can read (and, for pane agents, write) your files. Review the package source
and the agent definitions before installing. The setup script only links
files from this repository — inspect `scripts/setup.sh` to see exactly what
it does.

## Development checks

```bash
npm install        # dev tooling (eslint, prettier, typescript)
npm run validate   # dependency-free static validation
npm run typecheck
npm run lint
npm run format:check
bash -n scripts/setup.sh
```
