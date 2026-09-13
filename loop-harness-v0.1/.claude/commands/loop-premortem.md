---
description: Stage 2 — premortem. Assume it failed; work out why, and what was knowable today
allowed-tools: Read, Write, Glob, Grep
disable-model-invocation: true
---

Run stage 2. Use the `critic` agent.

## Preconditions

`REQUIREMENTS.md` must exist. If not, stop and point at `/loop-requirements`.

## Instruction to the critic

Read `IDEA.md` and `REQUIREMENTS.md`.

It is eighteen months from now. This project failed — not was cancelled,
**failed**, having consumed the full budget. Write how that happened, then
work backwards to what was knowable today.

Produce `CRITIQUE.md` covering:

1. **Fatal assumptions** — what must be true for this to work at all, ranked
   by damage × likelihood of being false
2. **Incoherence** — contradicting requirements, jointly unachievable
   targets, constraints ruling out the approach. Quote ids.
3. **The hard part** — the one genuinely difficult thing, as opposed to the
   several that merely look difficult
4. **Scope pressure** — the three most likely creep vectors, named specifically
5. **Operational reality** — who runs this at 3am, what breaks silently,
   what year two costs
6. **The unglamorous killers** — auth, migrations, error handling,
   observability, onboarding, permissions, billing, data export. Which are
   missing from the requirements entirely?
7. **Why hasn't this been done** — propose the reason; the researcher checks it
8. **The cheapest disproof** — the smallest thing that would prove this
   approach wrong. This becomes feature 1.

Each finding: severity (fatal / serious / manageable), what goes wrong, what
triggers it, whether it is knowable now, and the cheapest test.

End with a verdict: count of fatal findings, the single thing most likely to
kill this, and the one assumption to test first.

## Rules

- Specific or worthless. "Scalability concerns" is not a finding.
- Cite requirement ids. Every finding traces to something in
  `REQUIREMENTS.md` or names a gap in it.
- No compliments, no "this is strong, however". Skip it.
- Diagnose; do not prescribe. Someone else decides what to do.
- **No claims about the market, competitors, or what already exists.** You
  have no web access. Write those as questions for the researcher instead.
- Label your own assumptions. You are subject to the standard you apply.

## Then

    CRITIQUE.md written — <n> fatal, <n> serious
    Next: /loop-recon
