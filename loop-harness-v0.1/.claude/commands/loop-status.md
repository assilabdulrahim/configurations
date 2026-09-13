---
description: Where am I? Read-only report on plan progress, scope drift and budget
allowed-tools: Read, Glob, Grep, Bash(git log:*), Bash(git status:*)
---

# Context

- Git status: !`git status --short`
- Recent commits: !`git log --oneline -15`

# Task

Report the current state of the loop. Read-only — change nothing.

Cover:

1. **Phase.** Which artifacts exist: OBJECTIVE.md, CHALLENGE.md (answered or
   not), BUILD_PLAN.md, SCOPE.lock, test-results.json. Name the next command
   to run.

2. **Progress.** From `test-results.json`: features passing vs total. Name
   the next feature with `passes: false`.

3. **Blocked?** If `NEXT_FINDINGS.md` exists, summarise what the evaluator
   rejected and how many cycles it has been outstanding (count commits since
   the findings file first appeared).

4. **Budget.** Count commits containing a `feature-` id. Compare against the
   cycle ceiling in OBJECTIVE.md section 4. Flag if past 70%.

5. **Scope drift.** Compare feature ids in `BUILD_PLAN.md` against
   `SCOPE.lock`. Report any id in one but not the other. Also check
   PROGRESS.md for a `## Proposed scope change` section awaiting a decision.

6. **Stalled?** If the last three commits changed no source files, or if
   commits have stopped advancing the contract, say so plainly. A loop that
   is spinning is the expensive failure mode.

7. **Kill switch.** Report whether `AGENT_STOP` is present.

Be blunt. If the run looks like it is going badly, say that rather than
producing a neutral status table.
