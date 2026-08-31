---
description: Run the reviewer agent on the current changes (across all repos with edits), present the findings, apply approved fixes, then commit each repo
argument-hint: "[additional repos]"
agents: reviewer
---
Execute this workflow — one repo at a time, but reviewers run in parallel:

1. **Find all repos with changes.** Run `git status --short` in the current working directory. Also check any sibling checkouts the user mentions or lists as arguments: $@. Produce the complete list of `{repo root, changed files}` pairs. Ignore files the repos are configured to never commit (`.env`, `auth.json`, …).

2. **Review each repo with the `reviewer` agent — in parallel.** The reviewer is a bg agent (`pane: false`), so the subagent tool awaits its real output. Dispatch one task per repo with `agentScope: "both"` (the agent is user-level):

   - `cwd`: the repo root
   - task: "Review the current uncommitted changes in <repo root>. Changed files: <exact file list>. This file list is the source of truth — do not re-run git reconnaissance beyond confirming the diff. Return your standard severity-ranked findings (critical / warnings / suggestions)."

3. **Present the findings.** Show each repo's review summary to the user. Ask whether to apply the critical/warning fixes before committing (options: apply critical+warnings / critical only / none — commit as-is). The reviewer is read-only — you apply any approved fixes yourself.

4. **Commit per repo.** For each repo with changes:
   - If a commit skill is available in this session (check your available skills for something like `commit-plan` or similar), read and follow it for a structured commit flow. Treat each repo as its own commit cycle.
   - Otherwise, follow this fallback per repo:
     1. Analyze the diff and group changes into logical commits (split unrelated concerns).
     2. Present the grouping plan to the user and get approval before staging.
     3. Stage and commit group by group with clear messages following the repo's commit style.
     4. Run the repo's checks (tests, lint) before committing when they are fast; report any failures instead of committing broken code.
   - Never push. Commits stay local.

If a reviewer fails or returns an incomplete result for a repo, report that repo's status honestly and continue with the others only if the user approves.
