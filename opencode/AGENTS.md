# Project rules for AI agents

## Role
Act as a strong, careful senior developer. Prefer correct, minimal, idiomatic
changes over large speculative rewrites.

## Accuracy (reduce hallucination)
- Do not invent APIs, flags, file paths, or config keys. If unsure of a
  signature or behavior, read the source or say "unverified" — never guess.
- Base changes only on files you have actually read in this repo.
- Any factual claim about a library or framework must come from code you
  inspected or official docs; otherwise label it unverified.
- Prefer a small diff plus reasoning over sweeping edits.

## Workflow
- Detect the project's existing language version, style, and dependency
  manager before writing code, and match them.
- Make the smallest change that solves the task; call out anything left
  deliberately out of scope.
- After edits, summarize what changed and why in a few lines.

## Safety
- Never run destructive shell commands without asking.
- Never weaken tests just to make them pass.

---

# Coding standards

The repo you are in always wins. If existing code contradicts a rule below,
follow the existing code and mention the divergence — consistency inside one
codebase beats conformance to this file.

## Universal

**Naming.** Names carry the meaning; comments explain the reason. A name that
needs a comment to be understood is the wrong name. No abbreviations beyond
ones already used in the repo. Booleans read as assertions (`isValid`,
`hasExpired`), never as negations — `notInvalid` is banned.

**Functions.** One job each. If you need "and" to describe what it does, split
it. Guard-clause early returns over nested conditionals — the happy path
belongs at the lowest indentation level in the function.

**Comments.** Explain *why*, never *what*. A comment restating the code is
noise; delete it. Comments earn their place by recording a constraint, a
non-obvious reason, a rejected alternative, or a link to an issue. When you
change code, update or delete the comment above it — a stale comment is worse
than none.

**Errors.** Fail loudly and early. Never swallow an exception into a silent
default. Never catch broadly to make a symptom disappear. Error messages state
what was expected, what was received, and what the caller should do. If you
cannot handle an error meaningfully, let it propagate.

**Nesting.** Three levels is the ceiling. Beyond that, extract a function.

**Magic values.** No bare numbers or strings that carry meaning. Name them.

**Dead code.** Delete it; do not comment it out. Git remembers.

**Dependencies.** Check what the project already has before adding anything.
A new dependency needs a stated justification in your summary.

**Secrets.** Never hardcode credentials, keys, tokens, or connection strings.
Never log them. If you find one committed, stop and report it.

## C# / .NET

- Match the `TargetFramework` and `LangVersion` in the `.csproj`. Do not
  assume the newest.
- Nullable reference types enabled; no `!` null-forgiving operator without a
  comment justifying it.
- `async` all the way down. No `.Result`, no `.Wait()`, no `async void`
  outside event handlers. Suffix async methods with `Async`.
- Pass `CancellationToken` through every async call chain that accepts one.
- Constructor injection for dependencies. No service locator, no static
  mutable state.
- `var` when the type is evident from the right-hand side; explicit otherwise.
- Prefer `IReadOnlyList<T>` / `IReadOnlyDictionary<K,V>` on public surfaces.
- `record` for value-like types, `class` for entities with identity.
- `using` declarations for anything `IDisposable`.
- EF Core: no lazy loading, be explicit with `Include`. Never query inside a
  loop. Project to a DTO rather than returning entities from an API.
- Blazor: keep components small, prefer parameters over cascading values,
  dispose subscriptions in `IAsyncDisposable`, and never block on async in a
  lifecycle method.

## Python

- Match the project's Python version and dependency manager. Do not introduce
  a second one.
- Type hints on every public function signature. Run the project's type
  checker if it has one.
- Docstrings on public functions: one line on what it does, then args,
  returns, and raises if non-obvious.
- f-strings for formatting. No `%` and no `.format()` in new code.
- `pathlib.Path` over `os.path`.
- Never use a mutable default argument.
- Catch specific exceptions. A bare `except:` or `except Exception:` needs a
  comment justifying it, and must re-raise or log.
- Context managers for anything that must be released.
- Keep module-level code to definitions; put behavior behind
  `if __name__ == "__main__":`.

## PowerShell

- `#Requires -Version 7.0` at the top of every script.
- Comment-based help (`.SYNOPSIS`, `.DESCRIPTION`, `.PARAMETER`) on every
  script and public function. This repo already does this consistently —
  match the existing tone, which explains reasoning rather than restating
  syntax.
- Approved `Verb-Noun` names only (`Get-Verb` lists them).
- `[CmdletBinding()]` and typed `param()` blocks. Use `[ValidateSet()]` and
  friends instead of hand-rolled validation.
- `$ErrorActionPreference = 'Stop'` at the top; wrap fallible calls in
  try/catch. `-ErrorAction SilentlyContinue` suppresses output but not
  failure — do not use it as error handling.
- Support `-WhatIf` / `-Confirm` via `SupportsShouldProcess` on anything
  destructive.
- Output objects, not formatted text. Never use `Write-Host` for data;
  reserve it for interactive messages.
- Full cmdlet names in scripts; aliases only at the interactive prompt.
- Quote paths. Use `Join-Path` rather than string concatenation.

## Shell (bash)

- `set -euo pipefail` at the top.
- Quote every variable expansion: `"$var"`, not `$var`.
- `[[ ]]` over `[ ]`, `$(...)` over backticks.
- Check a command exists before relying on it.

## Tests

- Test names state the behavior and the condition:
  `Returns404_WhenUserDoesNotExist`.
- Arrange / Act / Assert, visually separated.
- One behavior per test. Assert on outcomes, not on interactions, unless the
  interaction *is* the contract.
- Deterministic: no real clock, no real network, no ordering dependence, no
  shared mutable fixture state.
- A bug fix ships with a test that fails before the fix and passes after.
- Never weaken an assertion to make a test pass. If a test is wrong, say so
  explicitly and explain why before changing it.

## Git

- Imperative subject under 72 characters, naming the change not the activity:
  `Fix null deref in token refresh`, not `fixed stuff`.
- Body explains *why* when it is not obvious from the diff.
- One logical change per commit. Do not bundle a refactor with a fix.

---

# Context handoff

Subagents start from an empty context. The orchestrator is the only component
that sees the whole session.

- `.opencode/handoff.md` is the session ledger. The **orchestrator is its only
  writer**; every other agent reads it and never edits it.
- Read the ledger before starting work. It records decisions already made and
  approaches already ruled out. Do not relitigate either.
- If a brief contradicts the ledger, say so rather than silently picking one.
- Never assume knowledge of an earlier turn. If the brief does not contain a
  fact you need, ask for it or go read the file yourself.

# Escalation

Stopping is a valid outcome. If a task exceeds your model's context or needs
judgment you cannot ground in code you have read, say so plainly and stop.
The orchestrator will re-route you to a stronger tier. Guessing to avoid
looking stuck is the failure mode this system exists to prevent.

# Validation

Your work will be checked by a different model from a different family. Write
for that reader:

- Say what you changed and why, in terms someone with no session history can
  verify.
- Flag anything you were unsure about. An acknowledged uncertainty gets
  checked; a hidden one ships.
- If you are the validator: you were chosen precisely because you did not
  write the code. Re-derive the hard parts rather than agreeing with the
  reasoning you are shown, and verify that every API used actually exists.
