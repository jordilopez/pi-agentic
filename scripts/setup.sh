#!/usr/bin/env bash
#
# Opt-in installer for the pi-agentic layer.
#
# Jobs:
#   1. `pi install $PI_GRAPH_PACKAGE`        - the orchestration package
#                                              (default @vanillagreen/pi-agents-tmux)
#                                              that provides the subagent tools.
#   2. `pi install ./`                        - register this repo as a pi
#                                              package so workflows/ load as
#                                              prompt templates (/name).
#   3. Symlink agents/*.md into ~/.pi/agent/agents/ - the user-scope agents
#      dir the orchestration package discovers.
#
# Idempotent: safe to re-run. Never overwrites user-owned files, never
# touches pi-setup.
#
# Teardown: `scripts/setup.sh --remove` undoes exactly what this script did.

set -euo pipefail

# Repo root (this script lives in scripts/)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS_SRC="$REPO_ROOT/agents"

# Orchestration package source. Override to pin a version or use a fork, e.g.:
#   PI_GRAPH_PACKAGE='npm:@vanillagreen/pi-agents-tmux@3.0.0' ./scripts/setup.sh
PI_GRAPH_PACKAGE="${PI_GRAPH_PACKAGE:-@vanillagreen/pi-agents-tmux}"

USER_AGENT_DIR="$HOME/.pi/agent/agents"
MODE="install"
if [[ "${1:-}" == "--remove" ]]; then
  MODE="remove"
fi

# ---- helpers ---------------------------------------------------------------

warn() { printf '\033[33m[setup]\033[0m %s\n' "$*" >&2; }
info() { printf '\033[32m[setup]\033[0m %s\n' "$*" >&2; }

# ---- 0. prerequisites ------------------------------------------------------

if ! command -v pi >/dev/null 2>&1; then
  warn "pi not found on PATH — install pi first, then re-run this script."
  exit 1
fi

if [[ -z "${TMUX:-}" ]] || ! command -v tmux >/dev/null 2>&1; then
  warn "tmux unavailable — agents with pane: true need tmux >= 3.5 and a tmux session."
  warn "bg agents (pane: false) work without it."
elif command -v tmux >/dev/null 2>&1; then
  tmux_version="$(tmux -V 2>/dev/null | sed -E 's/tmux ([0-9.]+).*/\1/' || true)"
  if [[ -n "$tmux_version" ]]; then
    # Numeric major/minor comparison — a lexicographic string compare would
    # mis-rank versions like 3.10 as older than 3.5.
    tmux_major="${tmux_version%%.*}"
    tmux_minor="${tmux_version#*.}"
    tmux_minor="${tmux_minor%%.*}"
    if [[ "$tmux_major" =~ ^[0-9]+$ && "$tmux_minor" =~ ^[0-9]+$ ]] && (( tmux_major < 3 || (tmux_major == 3 && tmux_minor < 5) )); then
      warn "tmux $tmux_version detected — pane agents require tmux >= 3.5"
    fi
  fi
fi

# ---- teardown mode ----------------------------------------------------------

if [[ "$MODE" == "remove" ]]; then
  info "Removing pi-agentic layer"

  # Agent symlinks owned by this repo (point into $AGENTS_SRC).
  if [[ -d "$USER_AGENT_DIR" ]]; then
    for target in "$USER_AGENT_DIR"/*.md; do
      [[ -L "$target" ]] || continue
      resolved="$(readlink "$target")"
      if [[ "$resolved" == "$AGENTS_SRC/"* ]]; then
        rm "$target"
        info "  removed agent link $(basename "$target")"
      fi
    done
  else
    info "  no agent directory at $USER_AGENT_DIR"
  fi

  # Package registrations (best effort — settings may already be clean).
  for pkg in "$REPO_ROOT" "$PI_GRAPH_PACKAGE"; do
    if pi remove "$pkg" >/dev/null 2>&1; then
      info "  pi remove $pkg"
    else
      warn "  could not pi remove $pkg (maybe not installed)"
    fi
  done

  info "Done. Restart pi (or /reload) to drop the workflows."
  exit 0
fi

# ---- 1. orchestration package ----------------------------------------------

info "Installing orchestration package: $PI_GRAPH_PACKAGE"
pi install "$PI_GRAPH_PACKAGE"

# ---- 2. this repo as a pi package (workflows -> prompt templates) -----------

info "Installing pi package from $REPO_ROOT (exposes workflows/ as /commands)"
pi install "$REPO_ROOT"

# ---- 3. agent symlinks -------------------------------------------------------

if [[ ! -d "$AGENTS_SRC" ]] || ! compgen -G "$AGENTS_SRC/*.md" >/dev/null; then
  warn "No agent files in $AGENTS_SRC — skipping agent symlinks."
else
  mkdir -p "$USER_AGENT_DIR"

  linked=0
  refreshed=0
  skipped=0
  removed=0
  for agent in "$AGENTS_SRC"/*.md; do
    [[ -e "$agent" ]] || continue
    name="$(basename "$agent")"
    target="$USER_AGENT_DIR/$name"

    if [[ -L "$target" ]]; then
      # Already a symlink: refresh so re-runs pick up moves/renames.
      ln -sf "$agent" "$target"
      refreshed=$((refreshed + 1))
    elif [[ -e "$target" ]]; then
      warn "Refusing to overwrite existing file: $target (not a symlink to this repo)"
      skipped=$((skipped + 1))
    else
      ln -s "$agent" "$target"
      linked=$((linked + 1))
    fi
  done

  # Remove stale symlinks: entries in the user dir that point into this repo
  # but no longer have a source file (renamed/deleted agents).
  for target in "$USER_AGENT_DIR"/*.md; do
    [[ -L "$target" ]] || continue
    resolved="$(readlink "$target")"
    if [[ "$resolved" == "$AGENTS_SRC/"* && ! -e "$resolved" ]]; then
      rm "$target"
      removed=$((removed + 1))
    fi
  done

  info "Agents in $USER_AGENT_DIR: $linked linked, $refreshed refreshed, $removed stale removed"
  if [[ "$skipped" -gt 0 ]]; then
    warn "$skipped existing file(s) left untouched"
  fi
fi

# ---- 4. next steps -----------------------------------------------------------

info "Done. Restart pi (or run /reload) to load the workflow prompt templates."
info "Agents are discovered fresh on each subagent invocation — no reload needed."
info "Invoke a workflow explicitly with its /command (see README.md)."
info "Teardown: $REPO_ROOT/scripts/setup.sh --remove"
