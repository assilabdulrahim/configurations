---
description: Stage 0 — start here. Tell me your idea and I'll interview you into IDEA.md
argument-hint: [your idea, or leave blank and I'll ask]
allowed-tools: Read, Write, Glob, Grep
disable-model-invocation: true
---

Start a new LOOP project.

Use the `interviewer` agent.

The user's opening statement: $ARGUMENTS

## If they gave nothing

Ask, and nothing else:

> What do you want to build?

## Then

Interview them into `IDEA.md`. One question at a time. Wait for each answer.

Establish, in whatever order the conversation makes natural:

- What outcome this produces, and for whom
- What happens today without it — the current workaround, however ugly
- Who the user is, concretely. A named role, not a market segment
- How they will know in six months whether it worked

## Rules

- Do not compliment the idea. Do not say it is interesting or promising.
- Do not propose features. They have not finished describing the problem.
- Do not assess whether it is a good idea — that is stage 2, and doing it
  here will bias what you extract.
- Do not fill in an answer you were not given.

## Output

`IDEA.md`, under one page. If you cannot state the idea in three sentences,
say so plainly — that is a finding, not a failure.

Then print exactly:

    IDEA.md written. Next: /loop-requirements

## Preconditions

If `IDEA.md` already exists, stop and ask before overwriting.
