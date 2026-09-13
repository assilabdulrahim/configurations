---
description: Phase 3 — lock scope. Produce BUILD_PLAN.md, SCOPE.lock and the default-FAIL contract
allowed-tools: Read, Write, Glob, Grep, Bash
disable-model-invocation: true
---

Run planner phase 3.

Use the `planner` agent.

## Preconditions — check all three before doing anything

1. `OBJECTIVE.md` exists.
2. `CHALLENGE.md` exists.
3. `CHALLENGE.md` contains human answers. If every question is still
   unanswered, STOP and say: the challenge phase has not been answered yet.
   Do not answer them yourself. Do not infer the answers.

If `BUILD_PLAN.md` already exists, this is a re-plan. Say so, show what
changes, and ask for confirmation before overwriting `SCOPE.lock`.

## Instruction to the planner

Using OBJECTIVE.md and the human's answers in CHALLENGE.md, write:

**BUILD_PLAN.md** — ordered features. Each one small enough for a single
session, independently verifiable, and traceable to a numbered
done-condition in OBJECTIVE.md. Any feature that does not trace to a
done-condition is scope creep: move it to a DEFERRED section at the bottom.

**SCOPE.lock** — one allowed feature id per line. The scope-gate hook reads
this. Nothing outside it may be built.

**test-results.json** — every feature id starts false:

    { "feature-1": { "passes": false } }

Never write true. You are not the evaluator.

**OUT_OF_SCOPE.txt** — one glob pattern per line, from section 3 of
OBJECTIVE.md, for the scope-gate hook to match against.

## After writing

Print a summary table of features and which done-condition each traces to,
then exactly:

    PLAN LOCKED — review BUILD_PLAN.md and cut scope now. Then commit, then: /loop-next

Tell the user this is the last cheap moment to remove work.
