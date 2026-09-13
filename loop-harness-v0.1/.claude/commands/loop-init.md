---
description: Start a new loop project — scaffold OBJECTIVE.md and interview me to fill it
argument-hint: [one-line goal]
allowed-tools: Read, Write, Glob, Grep
disable-model-invocation: true
---

The user wants to start a new loop-harness project.

Their one-line goal: $ARGUMENTS

## What to do

1. If `OBJECTIVE.md` already exists at the project root, STOP. Tell them it
   exists and ask whether to overwrite. Do not overwrite silently.

2. Read `templates/OBJECTIVE.md` for the structure.

3. Interview the user to fill it in. Ask about ONE section at a time and
   wait for the answer. Do not fill sections in on their behalf.

   Order: Goal → Done means → OUT of scope → Constraints → Known unknowns.

4. For the "Done means" table, refuse to accept a condition whose evidence
   column you cannot name a concrete artifact for. Push back once per row.
   A condition you cannot check is not a condition.

5. For "OUT of scope", if the user leaves it empty, tell them that an empty
   OUT-of-scope list means the evaluator has nothing to check creep against,
   and ask again. Accept empty only if they insist a second time.

6. For "Constraints", insist on a budget ceiling (max loop cycles). This is
   the number that bounds their spend.

7. Write the completed `OBJECTIVE.md` to the project root.

8. Print exactly:

       OBJECTIVE.md written. Next: /loop-challenge

## Do not

- Do not write BUILD_PLAN.md, SCOPE.lock, or test-results.json here.
- Do not start implementing anything.
- Do not soften a vague goal into a plausible one. If the goal is vague,
  say so and ask for the outcome, not the activity.
