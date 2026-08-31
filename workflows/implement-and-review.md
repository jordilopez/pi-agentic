---
description: Worker implements, reviewer reviews, worker applies feedback
argument-hint: "<task>"
agents: worker, reviewer
---
Execute this workflow with the subagent tool, one step per turn — `worker` is a pane agent and `reviewer` is a bg agent, so the chain parameter cannot be used (pane steps queue asynchronously instead of returning real output). Pass `agentScope: "both"` on every dispatch (the agents are user-level):

1. **Dispatch the worker** to implement: $@ (single subagent dispatch; the tool returns a "Queued task ... Task ID: ..." confirmation). **END YOUR TURN** — the worker runs in its visible pane and the completion arrives as a follow-up message that wakes you.
2. **On wake, collect the worker's result** (use the wake payload or `get_subagent_result` on the saved taskId — the worker's "Files Changed" / summary is the source of truth). Then dispatch the **reviewer** (bg agent, single dispatch — the tool awaits its real output) to review the implementation from the previous step. Pass the worker's output as {previous} context; the reviewer treats it as the source of truth and does not re-run reconnaissance.
3. **Approval gate:** present the reviewer's findings to the user and ask what to apply — all feedback / critical+warnings only / selected items / none. If none, report and stop here.

4. **Dispatch the worker again** (single subagent dispatch) to apply the approved feedback (pass the review and the user's selection as {previous}). **END YOUR TURN**; on the completion wake, report what changed.

If the worker fails, returns an incomplete result, or the reviewer finds critical issues the worker cannot resolve in one feedback round, stop and report to the user instead of looping again.
