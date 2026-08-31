# AGENTS.md — pi-agentic

Guidance for working in this repository.

## What this repo is

The optional agentic layer for pi. It contains only:

- `agents/` — role definitions (Markdown + frontmatter) symlinked into
  `~/.pi/agent/agents/` by `scripts/setup.sh`.
- `workflows/` — pi prompt templates exposed as `/commands` via the
  `pi.prompts` manifest entry.
- `scripts/` — `setup.sh` (opt-in install/teardown) and `validate.ts`
  (dependency-free static validation).
- `COMPATIBILITY.md` — the verified integration contracts. Re-verify before
  changing setup or frontmatter conventions.

## Boundary rules (do not violate)

- No extensions, no skills, no runtime TypeScript here. If a capability is
  generally useful, it belongs in `pi-setup` — but this repo must never be
  made a dependency of `pi-setup`, and vice versa.
- The orchestration package (`@vanillagreen/pi-agents-tmux`) is installed by
  `scripts/setup.sh` only, never added to any `package.json`.
- Skills never delegate to agents; workflows are the only delegation entry
  point and are always explicitly invoked.
- Never modify user-owned files in `~/.pi/agent/` other than the symlinks
  this repo owns (links resolving into this repo's `agents/` directory).
- Never switch the parent session's model from a workflow; per-agent models
  live in agent frontmatter only.

## Conventions

Agent files (`agents/<name>.md`):

- Frontmatter: `name` (matches filename), `description`, `model`,
  `model-reasoning-effort`, `pane`, optional `deny-tools`, and
  `allowed-subagents` when the agent may delegate recon.
- Models: `opencode-go/glm-5.3-flash` by default; `opencode-go/gpt-5.6-luna`
  for planning and review roles.
- Keep role instructions focused; do not duplicate skill content.

Workflow files (`workflows/<name>.md` → `/<name>`):

- Frontmatter: `description`, `argument-hint` when it takes arguments, and
  an `agents:` metadata line (comma-separated names used by the workflow) so
  validation can check the references.
- One workflow per composable scenario; declare handoffs, approval points,
  and failure behavior (report partial output, don't chain past a failure).
- Workflow commands use kebab-case filenames.

## Validation

`npm run validate` runs without dependencies and checks agent frontmatter,
workflow metadata, agent references, inventory, and the repository boundary.
Run it together with `bash -n scripts/setup.sh` before committing.
