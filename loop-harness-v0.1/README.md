# Loop harness v0.1 — Claude Code

Turns your project lifecycle playbook from a prompt document into a loop
with enforced scope and stopping conditions.

## The four phases

| Your phrasing | Artifact | Who owns it |
|---|---|---|
| Define the objective | `OBJECTIVE.md` | human |
| Challenge it to the details | `CHALLENGE.md` | planner writes, human answers |
| Define scope, no creep | `BUILD_PLAN.md` + `SCOPE.lock` + `test-results.json` | planner |
| Long-run till done | `run-loop.sh` | builder + evaluator |

## Sequence

    cp templates/OBJECTIVE.md ./OBJECTIVE.md
    $EDITOR OBJECTIVE.md

    claude --agent planner -p "Read OBJECTIVE.md and run phase 2."
    $EDITOR CHALLENGE.md            # <- the human checkpoint, do not skip

    claude --agent planner -p "CHALLENGE.md is answered. Run phase 3."
    $EDITOR BUILD_PLAN.md           # <- last chance to cut scope

    git init && git add -A && git commit -m "harness: plan locked"
    chmod +x run-loop.sh .claude/hooks/*.sh
    MAX_CYCLES=20 ./run-loop.sh

Stop a run at any time: `touch AGENT_STOP`

## Why the challenge phase is split across two invocations

An agent that challenges an objective and then immediately plans against
it will rationalise the scope it already inferred. Forcing a human answer
between phase 2 and phase 3 is the whole point. If you collapse it into
one session you have a very expensive prompt, not a harness.

## Stopping conditions (why they exist)

Three are wired in, all in `run-loop.sh`:

- `MAX_CYCLES` — hard budget ceiling
- `MAX_NO_PROGRESS` — consecutive cycles producing no commit
- `AGENT_STOP` — operator kill switch, checked every cycle and by the hook

An open loop with no stopping condition is how a small mistake becomes an
expensive one. Set `MAX_CYCLES` deliberately, not aspirationally.

## Provenance

Patterns are from two Anthropic Engineering posts —
*Effective harnesses for long-running agents* (Nov 2025) and
*Harness design for long-running application development* (Mar 2026) —
as summarised in the README of `github.com/anthropics/cwc-long-running-agents`.
Specifically: the planner agent, the default-FAIL contract, the
fresh-context evaluator, agent-maintained handoff, kill switch, and the
unattended outer loop.

**The code in this directory is mine, not Anthropic's.** I have not read
their hook source, only their README's description of it. Their repo is
the reference implementation; treat this as an adaptation to your
audit-before-implement discipline.

## Before you trust it

- **Untested.** Nothing here has been executed. The hook JSON paths in
  `scope-gate.sh` in particular are written against my expectation of the
  Claude Code hook payload, not against an observed one. Verify with a
  throwaway project first.
- Hooks are not loaded when you launch `claude` from a subdirectory. Run
  from the directory containing `.claude/`.
- Requires `jq` and `git`.
- Compare against the built-in `/goal` command before committing to a
  custom harness — for simple projects it may be all you need.

## Known gap

`test-results.json` is written by the wrapper on evaluator PASS, keyed off
a `feature-N` string in the commit subject. That is brittle. If the
builder writes a sloppy commit message the contract silently does not
advance, and you will burn cycles. Tighten this before any real run.
