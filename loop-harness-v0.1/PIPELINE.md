# The pipeline

Nine stages. `/loop-idea` to `/loop-spec`.

| # | Command | Agent | Output | Gate |
|---|---------|-------|--------|------|
| 0 | `/loop-idea` | interviewer | `IDEA.md` | — |
| 1 | `/loop-requirements` | interviewer | `REQUIREMENTS.md` | — |
| 2 | `/loop-premortem` | critic | `CRITIQUE.md` | — |
| 3 | `/loop-recon` | researcher | `LANDSCAPE.md` | — |
| 4 | `/loop-decide` | main context | `OBJECTIVE.md` or `DECISION.md` | **go / pivot / kill** |
| 5 | `/loop-challenge` | planner ph.2 | `CHALLENGE.md` | human answers |
| 6 | `/loop-plan` | planner ph.3 | `BUILD_PLAN.md`, `SCOPE.lock`, contract | human cuts scope |
| — | `/loop-spec` | spec-evaluator | `out/` bundle + adapters | rubric must pass |
| 7 | `/loop-next` | builder + evaluator | artifacts + evidence | automatic |
| 8 | — | driver | report | — |

Any time: `/loop-status`.

## Two exits

**Spec bundle** (default, cheapest) — stages 0–6 then `/loop-spec`. Deliverable
is `out/`, executable by any agent. Stage 7 never runs.

**Spec + smoke build** — as above, then `.\loop.ps1 -SmokeBuild` builds the
single riskiest feature as proof the spec is executable. If an agent cannot
build feature 1 from your spec, no downstream agent will do better.

Stage 7's full build loop remains available if you want this project built
here rather than handed off.

## `/loop-init` vs `/loop-decide`

Both produce `OBJECTIVE.md`. They are alternative entry points:

- **`/loop-init`** — the shortcut. You already know what you're building;
  skip discovery. Use for small, well-understood work.
- **`/loop-decide`** — the full path. `OBJECTIVE.md` is the *output* of
  interrogation, critique and recon rather than the input.

Do not run both. If `/loop-decide` finds an existing `OBJECTIVE.md` it will
ask before overwriting.

## The four gates

1. **Stage 4 — go / pivot / kill.** The only gate that can stop the project.
   KILL is a successful outcome and is recorded in `DECISION.md`.
2. **Stage 5 — answer `CHALLENGE.md`.** The only real check on scope.
3. **Stage 6 — cut scope in `BUILD_PLAN.md`.** Last cheap moment to remove work.
4. **`/loop-spec` — rubric.** Mechanical, not a judgement call. Six criteria,
   all must pass, three revision rounds maximum.

## Separation of concerns

Deliberate, and worth preserving if you edit these:

- **critic has no web access.** It attacks internal coherence only. Market
  claims from a tool-less agent are confabulation.
- **researcher must cite or mark unverified.** No third category.
- **evaluator and spec-evaluator have no write tools.** They grade; they do
  not fix. An agent that can edit what it grades will grade what it can edit.
- **interviewer never assesses the idea.** Judging quality during extraction
  biases what gets extracted.
- **the builder never writes `test-results.json`.** The driver does, on an
  evaluator PASS.

## Install

Global, once — every project sees it:

    ~/.claude/commands/     loop-*.md
    ~/.claude/agents/       interviewer, critic, researcher, planner,
                            evaluator, spec-evaluator
    ~/.claude/CLAUDE.md     builder protocol (or per-project)

Per project: `.loop/` state and `out/` deliverables. Nothing copied.

**Unverified:** the global `~/.claude/commands/` path is documented; the
equivalent for `agents/` I have not confirmed. Test with one agent before
moving all six.

## Not yet built

`loop.ps1` v2 (stages 0–4, `-SmokeBuild`, snapshots) · `loop_db.py` and the
SQLite lessons schema · lesson retrieval wired into `/loop-challenge`.

These depend on whether `claude -p "/loop-status"` resolves custom slash
commands in headless mode. Test that first.
