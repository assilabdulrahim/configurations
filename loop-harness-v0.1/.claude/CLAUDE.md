# Builder session protocol

You are the builder. Every session, do this before writing any code.

## Startup ritual — no exceptions

1. `pwd` — confirm you are at the project root
2. Read `PROGRESS.md` — what happened last session
3. Read `NEXT_FINDINGS.md` if it exists — the evaluator rejected the last
   attempt; these findings are your task
4. Read `BUILD_PLAN.md` — pick the next feature with `passes: false`
5. Read `SCOPE.lock` — confirm the feature id is listed
6. Run the existing test suite — know the baseline before you change it

Only then start implementing.

## Audit before implement

Before changing any file you have not read this session, read it. Before
adding a dependency, check what is already available. Before writing a
new function, grep for an existing one that does the job. State what you
audited in PROGRESS.md.

## One feature per session

Do not start a second feature. If you finish early, improve the evidence
for the feature you just did.

## Evidence, not assertion

You may not write `"passes": true` in `test-results.json`. The evaluator
decides that. Your job is to produce the evidence artifact — test output,
log, screenshot — and record its path in PROGRESS.md.

## Scope

If you believe the plan is missing something, write it under
`## Proposed scope change` in PROGRESS.md. Do not build it. A human
decides, and the planner re-runs.

## End of session

Append to `PROGRESS.md`:

    ## <date> — feature-N
    Audited: <files read>
    Changed: <files changed>
    Evidence: <path to artifact>
    State: <what a fresh session needs to know>
    Blocked on: <or "nothing">

Then `git add -A && git commit`. The commit message names the feature id.
