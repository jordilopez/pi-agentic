# Compatibility Note

Phase 0 output for `pi-agentic`: the verified integration contracts this
repository is built against. Re-verify these before upgrading the pinned
assumptions.

## Pi

- Installed version on this machine: **0.84.2** (`pi --version`).
- Packages are managed with `pi install` / `pi remove` / `pi list`, writing to
  `~/.pi/agent/settings.json` by default.
- A package is any directory with a `pi` manifest in `package.json`
  (keyword `pi-package`). Manifest resource types: `extensions`, `skills`,
  `prompts`, `themes`. Paths are relative to the package root; arrays support
  globs.
- Source docs: `packages.md` in the pi distribution.

## Orchestration package (resolves the "pi-graph" question)

- The npm package **`pi-graph` no longer exists**: the registry reports it as
  unpublished (2026-08-18). Do not reference it.
- The live orchestration extension is **`@vanillagreen/pi-agents-tmux`**,
  current version **3.0.0** (npm, last published 2026-08-24). This is the
  package the historical setup already targeted ("the subagent tool"
  documentation), and its docs are what the historical agents/prompts were
  written against.
- It exposes: `subagent`, `delegate_subagent`, `steer_subagent`,
  `get_subagent_result`, `wait_for_subagent_idle`, `stop_subagent`.
- Install via `pi install npm:@vanillagreen/pi-agents-tmux@3.0.0` (override with
  `PI_AGENTS_TMUX_PACKAGE` in `scripts/setup.sh`). The setup script pins 3.0.0
  by default so upgrades are deliberate.

## Agent discovery (confirmed)

- User scope: `~/.pi/agent/agents/*.md` (plus `~/.claude/agents`). This is the
  correct symlink target; the historical assumption still holds.
- Project scope: nearest `<project>/.pi/agents` plus `<project>/.claude/agents`.
- With `agentScope: "both"`, duplicate names resolve in this order: user
  Claude → user Pi → project Claude → project Pi. A project-local file with
  the same name therefore does not automatically override a global Pi agent.
- Agents are discovered fresh on each subagent invocation — no pi reload
  needed after linking.
- Frontmatter fields in current use:
  `name`, `description`, `model`, `model-reasoning-effort`, `pane` (true =
  persistent visible tmux pane; false = resumable bg agent), `deny-tools`
  (comma-separated), `allowed-subagents` (for child agents allowed to call
  `delegate_subagent`).

## Workflow format (confirmed)

- Workflows are **pi prompt templates**: Markdown files with optional
  frontmatter (`description`, `argument-hint`), invoked explicitly as
  `/name` in the editor. Discovery in a prompts directory is non-recursive.
- Discovery: global `~/.pi/agent/prompts/*.md`, project `.pi/prompts/*.md`,
  or via a package manifest (`pi.prompts`).
- This repository uses a `workflows/` directory exposed through
  `"pi": { "prompts": ["./workflows"] }`, so installing the repo as a pi
  package is what exposes the workflows. An `agents:` frontmatter key is
  added as local metadata (ignored by pi) so validation can check that every
  referenced agent exists.
- Reload note: prompt templates are picked up on pi restart / `/reload`.

## Models

- Provider `opencode-go` currently offers (verified in the local model
  store): `deepseek-v4-flash`, `deepseek-v4-pro`, `glm-5.3-flash`,
  `gpt-5.6-luna`, `hy4-preview`, among others.
- Decision: model assignments stay in agent frontmatter (`model:` +
  `model-reasoning-effort:`), as historically. Workflows never switch the
  parent session's model.
- Decision (user, 2026-08-31): all agents run on `opencode-go/glm-5.3-flash`
  except the planning and review roles (`planner`, `reviewer`), which use
  `opencode-go/gpt-5.6-luna`. The historical `deepseek-v4-flash` assignments
  are not carried over.

## Historical inventory triage

Agents (from `pi-setup@71e76d0^`):

| Agent    | Decision | Reason                                                                                                                                               |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| scout    | keep     | Core read-only recon role used by every workflow                                                                                                     |
| planner  | keep     | Core read-only planning role                                                                                                                         |
| worker   | keep     | Implementation role (pane); should gain `allowed-subagents: scout`                                                                                   |
| reviewer | keep     | Read-only review role                                                                                                                                |
| docs     | keep     | Useful pane specialist; no cross-repo coupling                                                                                                       |
| tester   | keep     | Useful pane specialist; no cross-repo coupling                                                                                                       |
| scaffold | drop     | `frontend-tip` in pi-setup now scaffolds in-session; the agent is decoupled and unused. Revisit only if isolated-context scaffolding is wanted again |

Workflows:

| Workflow             | Decision | Reason                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| scout-and-plan       | keep     | Minimal composable planning entry point                                                                                                                                                                                                                                                                                                                                |
| implement            | keep     | scout → planner → worker chain                                                                                                                                                                                                                                                                                                                                         |
| implement-and-review | keep     | worker → reviewer → worker loop                                                                                                                                                                                                                                                                                                                                        |
| review-and-commit    | adapt    | Originally depended on a `commit-full` skill in pi-setup that no longer exists. Migrated fully self-contained with the plan/execute split: reviewer (read-only) audits, the parent builds an approved commit plan from inline guidance, then the worker agent executes it (fixes, cleanup, tests, local commits). No skill references, no pi-setup runtime dependency. |

## tmux runtime guidance

- `pane: true` agents require Pi to run inside tmux. The current package
  requires tmux 3.5 or newer for the recommended extended-key configuration.
- Recommended `~/.tmux.conf` settings:

  ```tmux
  set -g extended-keys on
  set -g extended-keys-format csi-u
  ```

- The setup script checks tmux availability, version, whether the current
  shell is inside a tmux session, and (when inside one) the extended-key
  settings. It never edits `~/.tmux.conf`.
- The tmux server inherits the environment from the shell that starts it.
  Start it after the shell has initialized the `pi`/Node `PATH`; restart the
  server after changing that environment.
- pi-agents-tmux creates and resumes pane agents automatically. Use `/agents`
  and `/agents status` to inspect them, `/agents:attach` to focus one,
  `/agents:stop` to stop one while preserving its session, and `/agents collect`
  to collect completed results.

## Setup mechanics (decided)

- `scripts/setup.sh` is the only opt-in entry point. It:
  1. `pi install "$PI_AGENTS_TMUX_PACKAGE"` (default
     `npm:@vanillagreen/pi-agents-tmux@3.0.0`);
  2. `pi install <this repo>` (exposes `workflows/` as prompt templates);
  3. symlinks `agents/*.md` individually into `~/.pi/agent/agents/`
     (preserve foreign files, refresh owned symlinks, remove stale owned
     symlinks);
  4. prints exactly what it did.
- `scripts/setup.sh --remove` tears down only what this repo installed.
- `pi-setup` is never installed or modified by this repository.
