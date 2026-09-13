---
description: Stage 4 — the decision gate. Go, pivot, or kill. Drafts OBJECTIVE.md for you to approve.
allowed-tools: Read, Write, Glob, Grep
disable-model-invocation: true
---

Run stage 4. This is the decision gate.

Do NOT delegate this to a subagent. The main context should assemble it, and
the human decides.

## Preconditions

`REQUIREMENTS.md`, `CRITIQUE.md` and `LANDSCAPE.md` must all exist. If any is
missing, stop and name it.

## Step 1 — Assemble the case

Read all three. Present, in under one page:

    ## The decision

    **Idea:** <one sentence>

    **For:**  the strongest two or three reasons to build, drawn from the
              requirements and the gap identified in recon

    **Against:** every fatal finding from CRITIQUE.md, and the recon verdict.
              Do not soften these. Do not bury them under the "for" column.

    **The one thing that decides it:** the single question whose answer
              determines go or no-go

    **Cheapest disproof:** from CRITIQUE.md section 8

## Step 2 — State a recommendation

Recommend one of GO, PIVOT or KILL, and say why in two sentences.

Recommend KILL when the evidence supports it. A recon verdict of OCCUPIED, or
an unresolved fatal finding, should produce KILL or PIVOT — not GO with
caveats. **The value of this gate is entirely in its willingness to say no.**
A gate that always says go is a formality.

## Step 3 — Ask

Ask the human to choose: GO, PIVOT, or KILL. Wait. Do not proceed on an
assumed answer.

## Step 4 — Act on the answer

**KILL.** Write `DECISION.md` recording what was decided, why, and what would
have to change to revisit it. This is a successful outcome — say so plainly,
without consolation. Then stop. Do not offer to build a smaller version
unless asked.

**PIVOT.** Write `DECISION.md` with what changes and what stays. Then say:
re-run `/loop-requirements` with the revised idea. Do not attempt to patch
the existing requirements — a pivot invalidates the interrogation.

**GO.** Draft `OBJECTIVE.md` from `templates/OBJECTIVE.md`:

- **Goal** — one sentence, outcome not activity
- **Done means** — numbered done-conditions, each with named evidence, drawn
  from the acceptance tests in REQUIREMENTS.md
- **Explicitly out of scope** — from REQUIREMENTS.md, plus anything CRITIQUE
  flagged as a creep vector
- **Constraints** — including the cycle budget ceiling
- **Known unknowns** — every unresolved item from CRITIQUE and every entry in
  the recon's "what I could not verify"

Mark anything you inferred rather than extracted with `TODO:` and a specific
question.

Then print:

    OBJECTIVE.md drafted. Review and fill every TODO — this is yours to
    approve, not mine to assume.
    Next: /loop-challenge

## Rules

- Do not decide on the human's behalf.
- Do not weight "for" above "against" to be encouraging. Present both flat.
- If the recon verdict is OCCUPIED and you still recommend GO, justify it
  explicitly against the incumbent. Vague differentiation is not a case.
