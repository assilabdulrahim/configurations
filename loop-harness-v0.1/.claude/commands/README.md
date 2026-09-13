# Slash commands

Drop these in `.claude/commands/` at your project root. Filename = command
name. Type `/loop-` and autocomplete shows all five.

| Command | Phase | Side effects |
|---|---|---|
| `/loop-init [goal]` | define the objective | writes OBJECTIVE.md |
| `/loop-challenge` | challenge it to detail | writes CHALLENGE.md, then stops |
| `/loop-plan` | lock scope | writes BUILD_PLAN.md, SCOPE.lock, test-results.json, OUT_OF_SCOPE.txt |
| `/loop-next` | one cycle | builds, commits, evaluates, updates contract |
| `/loop-status` | — | none, read-only |

## The intended sequence

    /loop-init Emit a CycloneDX 1.6 CBOM that passes the official validator
    <answer the interview>

    /loop-challenge
    <answer the questions inline in CHALLENGE.md>     <- human checkpoint

    /loop-plan
    <cut scope in BUILD_PLAN.md, then git commit>     <- last cheap moment

    /loop-next
    /loop-next
    /loop-status
    ...

## Why `/loop-next` is one cycle and not a loop

A slash command is a prompt template, not a process — it cannot loop over
itself. That is a feature here: every cycle returns control to you, which is
the stopping condition the bash wrapper had to simulate with `MAX_CYCLES`.

If you want it unattended, wrap `/loop-next` in `/goal` and set the
completion condition to every feature passing. You then get automatic
iteration with the built-in evaluator on top of yours.

## PowerShell

These five are pure markdown and run identically on Windows. `/loop-status`
is the only one that shells out, and it only calls `git`, which behaves the
same on both platforms. **This is the Windows-native path** — you do not
need `run-loop.sh`, `jq`, or WSL to use the harness this way.

`disable-model-invocation: true` is set on the four side-effect commands, so
Claude cannot trigger them on its own — only you can, by typing the slash
command. Verified as the documented pattern for side-effect commands.

## Untested

None of these has been executed. In particular I have not verified that
`/loop-challenge` and `/loop-plan` reliably delegate to the `planner`
subagent rather than the main context doing the work inline. Check the first
run: if the main agent does the planning itself, add an explicit
"Use the planner agent to..." line at the top of the body.
