---
description: Phase 2 — attack the objective and write CHALLENGE.md, then stop for my answers
allowed-tools: Read, Write, Glob, Grep, Bash
disable-model-invocation: true
---

Run planner phase 2 against `OBJECTIVE.md`.

Use the `planner` agent for this. Do not do it yourself in the main context —
the whole point is a fresh context that has not already absorbed the
conversation's assumptions.

## Preconditions

- `OBJECTIVE.md` must exist. If not, stop and say: run `/loop-init` first.
- If `CHALLENGE.md` already exists and contains human answers, stop and say
  so. Ask before overwriting.
- If `OBJECTIVE.md` has fewer than two done-conditions with named evidence,
  refuse and say which rows are unfalsifiable.

## Instruction to the planner

Read OBJECTIVE.md and the existing codebase. Then write CHALLENGE.md
covering, at minimum:

1. Ambiguities — every phrase with two readings, both stated, neither chosen
2. Unstated assumptions
3. Missing done-conditions
4. Unfalsifiable conditions
5. Scope pressure — the three most likely creep vectors, named specifically
6. Cheapest disproof — the smallest build that would prove the approach wrong

Your job in this phase is to attack the objective, not serve it.

## Then STOP

Do not proceed to planning. Print exactly:

    CHALLENGE COMPLETE — answer the questions inline in CHALLENGE.md, then: /loop-plan

The gap between this command and `/loop-plan` is a human checkpoint. It is
the only real check on scope in this harness. Do not collapse it.
