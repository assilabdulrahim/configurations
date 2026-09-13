---
description: Emit the agent-agnostic spec bundle plus per-agent adapters. Graded against the rubric until it passes.
argument-hint: [optional: adapter names, default all]
allowed-tools: Read, Write, Edit, Glob, Grep
disable-model-invocation: true
---

Emit the deliverable: a model-agnostic specification bundle that any coding
agent can execute.

Adapters requested: $ARGUMENTS (default: all)

## Preconditions

`OBJECTIVE.md`, `REQUIREMENTS.md`, `BUILD_PLAN.md`, `SCOPE.lock` and
`test-results.json` must exist. If `BUILD_PLAN.md` is missing, run
`/loop-plan` first.

## Step 1 — Write `out/SPEC.md`

The substance. **No Claude-specific content** — no mention of subagents,
hooks, slash commands, or this harness. A different agent on a different
model must be able to execute this without knowing how it was produced.

    # <Project>

    ## Goal
    ## Scope — in
    ## Scope — out
    ## Functional requirements
    | id | requirement | acceptance test | traces to |
    ## Non-functional requirements
    | id | requirement | measure | threshold |
    ## Data
    ## Deployment
    ## Integration
    ## Dependencies
    | component | version | licence | why |
    ## Build order
    Features in dependency order, each traced to a requirement id.
    ## Known unknowns
    ## Out of scope for v1

Carry `Known unknowns` through from OBJECTIVE.md. A spec that has quietly
resolved its own open questions has invented answers.

## Step 2 — Copy the machine-readable artifacts

`out/BUILD_PLAN.md`, `out/test-results.json`, `out/RUBRIC.md`.

## Step 3 — Grade it

Invoke the `spec-evaluator` agent on `out/SPEC.md`.

If NEEDS_WORK: fix exactly the findings, re-grade. Repeat, maximum three
rounds. If it still fails after three, stop and report which criteria cannot
be met and why — that is a real finding about the requirements, not a
formatting problem to grind at.

Do not proceed to adapters until the spec passes.

## Step 4 — Emit adapters

Each adapter is **thin**. It references SPEC.md; it does not restate it.

`out/adapters/claude-code.md` — CLAUDE.md conventions, suggested subagent
split, one-feature-per-session protocol, evidence requirements.

`out/adapters/cursor.md` — equivalent conventions for Cursor's rules format.

`out/adapters/generic.md` — the flat all-inclusive prompt, for agents with no
configuration surface. **This one inlines SPEC.md in full**, because there is
nothing to reference. It is generated from the bundle, never authored
directly — if it drifts from SPEC.md, SPEC.md wins.

## Step 5 — Report

    SPEC BUNDLE EMITTED — out/
      SPEC.md            <n> functional, <n> non-functional requirements
      rubric             PASS (round <n>)
      adapters           <list>
      known unknowns     <n> unresolved

    Optional next: .\loop.ps1 -SmokeBuild
      Builds the single riskiest feature as proof the spec is executable.

## Rules

- Never mark the spec as passing yourself. The evaluator decides.
- Never resolve a known unknown to make the spec look complete.
- Never let an adapter contradict SPEC.md. Regenerate; do not hand-patch.
