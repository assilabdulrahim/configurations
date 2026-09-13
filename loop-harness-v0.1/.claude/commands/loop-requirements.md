---
description: Stage 1 — interrogate the idea into full requirements: functional, non-functional, data, deployment, constraints
allowed-tools: Read, Write, Glob, Grep, WebSearch
disable-model-invocation: true
---

Run stage 1. Use the `interviewer` agent.

## Preconditions

`IDEA.md` must exist. If not, stop and say: run `/loop-idea` first.

If `REQUIREMENTS.md` exists, this is a revision. Say what you are revising
and ask before overwriting.

## Instruction

Read `IDEA.md`. Interview the user until every area below is covered. One
question at a time — the user should be doing most of the talking.

Cover: functional · non-functional · data · deployment · integration ·
constraints · out of scope.

Do not read this list aloud. Ask naturally, ordering by consequence: the
question that would most change the design if answered differently comes
first.

## Two things to be strict about

**Numbers.** Every non-functional requirement needs a measure and a
threshold. When the user says "fast", "secure", "scalable" or "reliable",
ask what number. Once. If they genuinely do not know, record it as
`THRESHOLD UNKNOWN` — do not invent one and do not quietly drop it.

**Out of scope.** Push here. If the user cannot name three things this will
not do, the idea is not bounded yet and everything downstream loses its only
defence against creep.

## Acceptance tests

For every functional requirement ask: **how would we know this works?**

Record the answer. If neither of you can name a way to check it, mark it
`UNTESTABLE`. Do not invent a test — the rubric is supposed to catch these.

## Output — `REQUIREMENTS.md`

Sections: Functional (table: id, requirement, acceptance test, traces to) ·
Non-functional (id, requirement, measure, threshold) · Data · Deployment ·
Integration · Constraints · Out of scope · Open questions · Assumptions I
made and you should check.

The last two are mandatory and must not be empty.

## Stopping condition

Stop when every requirement meets all six criteria in `templates/RUBRIC.md` —
not when you run out of questions.

Report which criteria are met and which are not, then print:

    REQUIREMENTS.md written — <n>/6 rubric criteria met
    Next: /loop-premortem
