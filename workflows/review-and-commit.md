---
description: Reviewer audits uncommitted changes across repos, an approved commit plan is made per repo, then a worker executes it (fixes, cleanup, tests, commits)
argument-hint: "[additional repos]"
agents: reviewer, worker
---
Execute this workflow — one repo at a time, but reviewers run in parallel:

1. **Find all repos with changes.** Run `git status --short` in the current working directory. Also check any sibling checkouts the user mentions or lists as arguments: $@. Produce the complete list of `{repo root, changed files}` pairs. Ignore files the repos are configured to never commit (`.env`, `auth.json`, …).

2. **Review each repo with the `reviewer` agent — in parallel.** The reviewer is a bg agent (`pane: false`), so the subagent tool awaits its real output. Dispatch one task per repo with `agentScope: "both"` (the agent is user-level):

   - `cwd`: the repo root
   - task: "Review the current uncommitted changes in <repo root>. Changed files: <exact file list>. This file list is the source of truth — do not re-run git reconnaissance beyond confirming the diff. Return your standard severity-ranked findings (critical / warnings / suggestions)."

3. **Present the findings and decide what goes into the commit plan.** Show each repo's review summary to the user. Ask whether to apply the critical/warning fixes before committing (options: apply critical+warnings / critical only / none — commit as-is).

4. **Create the commit plan (planning-only — do not edit, stage, or commit yet).** For each repo, produce an executable commit plan: dependency-ordered commit groups with exact files, conventional commit types, and proposed messages; required cleanup (debug statements, debug artifacts, JSDoc for changed exported APIs) and focused tests to add or update; an execution checklist with the exact staging order, the narrowest relevant validation commands (tests, typecheck, lint, format) and their expected results, plus the rules to inspect the diff after edits, to stop and report failures instead of committing them, to commit only after approval and validation, and never to push or open PRs. Fold the user-approved review fixes from step 3 into the plan as explicit tasks. Distinguish required work from optional follow-ups, and mark unrelated or pre-existing changes as left untouched. Present the plan and get the user's approval before executing.

5. **Execute the approved plan with the `worker` agent (pane agent).** Dispatch one worker per repo with `agentScope: "both"`, `cwd` set to the repo root, and the approved plan as the task (pass it as {previous} context — the plan is the source of truth; the worker must not re-run the analysis). Instruct the worker to: follow the plan exactly and ask before any scope change; apply the fixes, cleanup, and tests; run the listed checks; stage and commit group by group only after validation passes; and never push. **END YOUR TURN** — the worker runs in its visible pane and the completion arrives as a follow-up message that wakes you.

6. **On wake, report per repo** (use the wake payload / `get_subagent_result` on the saved taskId): what was committed, which checks ran, and anything the worker flagged. If the worker failed or stopped on a check failure, report the failure honestly and do not retry without asking.

If the user prefers not to use a worker, offer to execute the approved plan directly in this session instead — but ask first; delegation is the default.
