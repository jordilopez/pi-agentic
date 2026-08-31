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
  setup script; override with `PI_AGENTS_TMUX_PACKAGE`)

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

### Configure tmux before using pane agents

`worker`, `docs`, and `tester` use `pane: true`, so Pi must be running inside
a tmux session for them to open visible persistent panes. `scout`, `planner`,
and `reviewer` use background sessions and do not require tmux.

Use tmux 3.5 or newer. Add this to `~/.tmux.conf` — the setup script checks
for it but never edits your tmux configuration:

```tmux
set -g extended-keys on
set -g extended-keys-format csi-u
```

Reload the configuration:

```bash
tmux source-file ~/.tmux.conf
```

If modified keys still behave incorrectly, start a fresh tmux server after
saving any work in existing sessions:

```bash
tmux kill-server   # closes all tmux sessions; use only when that is safe
tmux new-session -A -s pi-agentic
```

Start Pi from the tmux session, preferably from the project directory where
the work will happen:

```bash
tmux new-session -A -s pi-agentic
cd ~/path/to/project
pi
```

The tmux server inherits the environment of the shell that starts it. If Pi
or Node was installed through a version manager, start tmux after that
manager has initialized, and restart the server after changing `PATH`.

When a pane agent is dispatched, pi-agents-tmux creates or resumes its
persistent pane automatically. You do not need to create a pane manually.
Useful commands inside Pi include:

- `/agents` — browse project and user agents.
- `/agents status` — inspect persistent pane state.
- `/agents:attach <name>` — focus an agent pane.
- `/agents:send <name> <task>` — queue work for a pane agent.
- `/agents:stop <name>` — stop a pane while preserving its session memory.
- `/agents collect` — collect completed pane results.

If panes do not appear, check `echo "$TMUX"`, `tmux -V`, and `command -v
pi` from the same tmux shell. Also confirm that the agent has `pane: true`
and that the orchestration package is enabled. Stop and restart a pane if it
retains a stale project directory.

After installation: restart pi (or `/reload`) so the workflow prompt
templates load. Agents are discovered fresh on each subagent invocation — no
reload needed for agent edits.

## Invoke a workflow

Workflows are prompt templates. Type `/` in the pi editor to see them:

- `/scout-and-plan <task>` — scout gathers context, planner creates an
  implementation plan. No implementation.
- `/implement <task>` — scout → planner → worker chain.
- `/implement-and-review <task>` — worker implements, reviewer reviews,
  worker applies feedback.
- `/review-and-commit [repos]` — reviewer audits uncommitted changes across
  repos, approved fixes are applied, then commits (local only, no push).

Nothing runs unless you explicitly invoke a workflow. A normal skill (e.g.
`/frontend-tip`) remains a direct active-session operation. Agents and
workflows are fully self-contained: they never call skills by name, so
`pi-setup` does not need to be installed.

## How agents are linked

Each `agents/<name>.md` is symlinked individually into
`~/.pi/agent/agents/<name>.md`. The orchestration package discovers them
(user scope) on every subagent call. Edits to files in this repo take effect
immediately — the link points at the source file.

## Customizing agents per project

The agents here are **generic role definitions** — deliberate starting
points, not project-specific workers. For per-project behavior, create a
project-scope agent in the nearest `<project>/.pi/agents/` directory (or
`.claude/agents/`) using the same frontmatter format.

The current pi-agents-tmux resolution order for `agentScope: "both"` is:
user Claude → user Pi → project Claude → project Pi. Therefore, a project
agent with the same name does not automatically override the generic user Pi
symlink. Use one of these safe patterns:

1. Give the project-specific role a distinct name and reference that name in
   a project-local workflow.
2. Use a project-local workflow with `agentScope: "project"` when the project
   should provide the role definition exclusively.
3. If intentionally replacing a global role, remove or rename the global
   symlink first, then verify the selected definition with `/agents`.

Never edit the files in this repository to tweak one project: keep them
generic and put project-specific behavior in the project's own agents
folder.

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
