---
description: Run ONE build-then-evaluate cycle. The cross-platform replacement for run-loop.sh
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
disable-model-invocation: true
---

Run exactly one cycle of the loop. One cycle. Do not continue to a second
feature after this one completes, whatever the outcome.

This command is the manual, cross-platform equivalent of `run-loop.sh` — it
works identically on PowerShell, since it uses no shell scripting.

## Preconditions

Stop if any of `OBJECTIVE.md`, `BUILD_PLAN.md`, `SCOPE.lock`,
`test-results.json` is missing — say which, and point at `/loop-plan`.

Stop immediately if `AGENT_STOP` exists at the project root. Say the
operator kill switch is set and that they should delete the file to resume.

## Step 1 — Build

Follow `.claude/CLAUDE.md` exactly, including the startup ritual.

If `NEXT_FINDINGS.md` exists, your task is those findings and nothing else.
Otherwise pick the first feature in `BUILD_PLAN.md` whose entry in
`test-results.json` is false.

Confirm the feature id appears in `SCOPE.lock` before writing any code. If
it does not, stop — the plan and the lock have diverged.

Produce a real evidence artifact. Not a claim that tests pass — the actual
output, written to a file. Record its path.

Commit. The commit subject must contain the feature id, exactly in the form
`feature-N`. The contract update depends on this string.

## Step 2 — Evaluate

Invoke the `evaluator` agent on the commit you just made. Give it the diff,
BUILD_PLAN.md, SCOPE.lock and OBJECTIVE.md.

Do not summarise your own work to the evaluator. Point it at the artifacts
and let it read them.

## Step 3 — Record

**If the evaluator's first line is PASS:**
- delete `NEXT_FINDINGS.md` if present
- set that feature's `passes` to true in `test-results.json`
- report which features remain false

**If NEEDS_WORK:**
- write the evaluator's findings verbatim to `NEXT_FINDINGS.md`
- do NOT touch `test-results.json`
- do NOT attempt the fix now — that is the next cycle

## Step 4 — Report and stop

Print:

    CYCLE COMPLETE — <feature-id> <PASS|NEEDS_WORK>
    remaining: <n> features
    next: /loop-next   (or /loop-status)

Then stop. Do not start another cycle.

## Hard rules

- You may never set `passes: true` on a feature the evaluator did not pass.
- You may never edit `OBJECTIVE.md`, `SCOPE.lock`, or `CHALLENGE.md`.
- If you think the plan is wrong, write it under `## Proposed scope change`
  in PROGRESS.md and say so. Do not build it.
