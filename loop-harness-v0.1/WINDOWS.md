# Windows quickstart

## One-time setup — install once, use from any project

    Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
    cd path\to\loop-harness-v0.1
    .\setup.ps1

This copies `commands\`, `agents\`, `CLAUDE.md` and `templates\` into
`%USERPROFILE%\.claude` — Claude Code's own global config directory. One
copy serves two things:

- typing `/loop-idea` inside an interactive `claude` session, from any
  project, using Claude Code's normal global resolution
- `loop.ps1` reading the same files headlessly, from any project

**You never copy the harness into a new project again.** What lives in a
project folder is only the project's own state — `OBJECTIVE.md`,
`CHALLENGE.md`, `BUILD_PLAN.md`, `.loop\`, `out\` — created by the harness
as you go, not copied in by you.

Put `loop.ps1` itself somewhere on your PATH (or a fixed folder you `cd` to),
since it's the driver, not part of the installed harness:

    Copy-Item .\loop.ps1 C:\Tools\loop.ps1
    # then run it from anywhere as: C:\Tools\loop.ps1 -Goal "..."
    # or add C:\Tools to PATH and just call: loop.ps1 -Goal "..."

## Starting a new project

    mkdir C:\projects\my-idea
    cd C:\projects\my-idea
    loop.ps1 -Goal "Emit a CycloneDX 1.6 CBOM that passes the official validator"

That's the whole setup for project #2, #3, #47. No `.claude` folder to
create, no files to copy — `loop.ps1` reads the central install and writes
only project state locally. (First run per project seeds a `.\templates`
copy automatically, since the command files reference templates as a
project-relative path — see "Why templates get copied" below.)

Resume an interrupted run — the driver detects where you are:

    loop.ps1

Other entry points:

    loop.ps1 -Phase status
    loop.ps1 -Phase execute -MaxCycles 10
    New-Item AGENT_STOP            # halt a run in progress

## Why templates get copied but commands/agents don't

Commands and agents are read directly from `-HarnessRoot` (default
`~\.claude`) — no reason to duplicate them, they're not edited per project.

Templates are different: `OBJECTIVE.md` and `RUBRIC.md` are meant to become
*your project's* filled-in files. The command bodies reference them as
`templates\OBJECTIVE.md`, a path relative to the project root (since that's
Claude's working directory when it reads them). So `loop.ps1` seeds
`.\templates` from the central copy once, on first run in a new project —
after that it's yours to edit, same as any other project file.

## The three powers, honestly described

**Self-execution.** The driver detects which artifacts exist and runs the
next phase. You type one command for a whole project, not five per project.

**Self-correction.** Real, and it is the strongest part. A NEEDS_WORK
verdict writes `NEXT_FINDINGS.md`; the next cycle's opening prompt becomes
those findings. The builder cannot advance past a feature the evaluator
rejected, and it cannot mark its own work as passing — the driver writes the
contract, not the agent.

**Self-conclusion.** The run ends on one of four conditions: contract fully
satisfied, cycle budget exhausted, no commit for N consecutive cycles, or
`AGENT_STOP`. It always prints which one fired. A loop that ends without
telling you why is the expensive failure mode.

## What it deliberately does not do

It does not skip the human checkpoints. There are three:

1. Fill the TODOs in `OBJECTIVE.md`
2. Answer the questions in `CHALLENGE.md`
3. Cut scope in `BUILD_PLAN.md`

`-Unattended` skips 2 and 3. Understand what you lose: the agent then
challenges its own objective, answers its own questions, and plans against
its own answers. Scope control is off. The self-correction loop still works
— but it is correcting toward a target nothing checked. Use it only on a
project you have already run attended once.

This is not caution for its own sake. Your playbook's value was the
audit-before-implement discipline; those three pauses are where that
discipline lives. Automating them away converts the harness back into an
expensive prompt.

## Hooks on Windows

`kill-switch.sh` and `scope-gate.sh` are bash. Two options:

- Leave them out. `loop.ps1` checks `AGENT_STOP` every cycle and writes the
  contract itself, so the two things the hooks protect are covered at the
  driver level. **This is the simpler path and what I would start with.**
- Port them to `.ps1` and register them in settings. Only worth doing if you
  want enforcement mid-session rather than between cycles.

Claude Code has run natively on Windows since 2025 and no longer requires
WSL or Git for Windows; the native PowerShell tool shipped in v2.1.139
(May 2026). Disregard any earlier advice in this project to use WSL.

## Before you trust any of this

- **`loop.ps1` has never been executed and was never syntax-checked** — I
  had no PowerShell available. Read it, then dry-run it on a throwaway repo.
- **Confirmed 2026-07-30: `claude -p "/command"` does NOT resolve custom
  slash commands in headless mode.** Tested directly — `claude -p
  "/loop-status"` ran as plain text; Claude reasoned about the literal
  string instead of executing the command file. This was the assumption
  flagged as unverified, and it was wrong.

  `loop.ps1` now works around it: `Get-CommandPrompt` reads each
  `.claude/commands/*.md` file, strips the YAML frontmatter, substitutes
  `$ARGUMENTS`, and sends the body directly as the prompt. The `.md` files
  are still the single source of truth — the driver just stops pretending
  headless can resolve them by name. This is what makes `loop.ps1` work
  regardless of the item below.

- **Still unverified: whether typing `/loop-idea` INTERACTIVELY (inside
  `claude`, no `-p`) resolves commands installed globally at `~\.claude`,
  as opposed to project-local `.\.claude`.** This only affects the
  convenience of typing commands by hand in a chat session — `loop.ps1`
  does not depend on it either way, since it reads the files itself. Test
  it once after `setup.ps1`: run `claude` from an empty folder with no
  local `.claude`, type `/`, and check whether `loop-` entries appear.
- `--allowedTools` and `--permission-mode acceptEdits` are documented
  headless flags. `acceptEdits` means file edits proceed without asking.
  That is the point of unattended operation and also its main risk. Run it
  in a repo you can `git reset --hard`.
- The contract advances by matching `feature-N` in the commit subject. If
  the builder writes a sloppy message the driver says so and does not
  advance. Tighten this before a long run.
