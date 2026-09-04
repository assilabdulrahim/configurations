---
description: Python implementation - code, scripts, packaging, virtualenvs, type hints. Use for Python tasks.
mode: subagent
model: moonshotai/kimi-k2.7-code
# kimi-for-coding/k3-256k is unreachable - see architect.md's comment for why.
# kimi-k2.7-code is the closest public equivalent: same 256k window, but a
# different underlying model version, not a renamed identical one. Metered,
# not flat. See agents/orchestrator.md §2 and §3.
temperature: 0.1
permission:
  edit: allow
  bash:
    "*": ask

    # Destructive or outbound. Listed FIRST and kept non-overlapping with the
    # read set below, so the outcome never depends on match precedence.
    "sudo *": deny
    "rm *": deny
    "rmdir *": deny
    "mv *": ask
    "chmod *": ask
    "chown *": ask
    "curl *": ask
    "wget *": ask
    "git push *": ask
    "git reset *": ask
    "git clean *": ask
    "find * -delete*": deny
    "find * -exec*": deny

    # Read-only shell. Each verb appears bare AND with arguments: "ls *"
    # needs a space and an argument, so a plain "ls" would otherwise fall
    # through to "*": ask - that fall-through was the main source of prompts.
    "pwd": allow
    "ls": allow
    "ls *": allow
    "tree": allow
    "tree *": allow
    "cat *": allow
    "head *": allow
    "tail *": allow
    "wc *": allow
    "stat *": allow
    "file *": allow
    "du *": allow
    "df *": allow
    "which *": allow
    "echo *": allow
    "grep *": allow
    "rg *": allow
    "fd *": allow
    "find *": allow
    "jq *": allow
    "sed -n *": allow

    # git, read-only subcommands. Mutating ones are absent, not merely denied.
    "git status": allow
    "git status *": allow
    "git diff": allow
    "git diff *": allow
    "git log": allow
    "git log *": allow
    "git show *": allow
    "git blame *": allow
    "git grep *": allow
    "git ls-files*": allow
    "git rev-parse *": allow
    "git describe*": allow
    "git shortlog*": allow
    "git remote -v": allow
    "git cat-file *": allow
    "git config --get *": allow
    "git stash list": allow
    "git worktree list": allow
    "git branch": allow
    "git branch -a": allow
    "git branch -v": allow
    "git branch -vv": allow
    "git branch --list *": allow
    "git branch --merged*": allow
    "git tag": allow
---
You are a senior Python developer.
- Read `.opencode/handoff.md` first if it exists.
- Match the project's existing style, Python version, and dependency manager.
- Add type hints and docstrings; keep functions small and testable.
- Do not invent library APIs - if unsure of a signature, read the source or say so.
- Show a short diff summary after changes.

## Signals

You cannot change your own model. If you hit a wall, emit ONE of these as the
first line of your reply and stop - the router re-routes you:

    CONTEXT_OVERFLOW: <what you still need to read, and roughly how much>
    ESCALATE: <the judgment you cannot ground in code you have read>
    BLOCKED: <the missing fact, decision or credential>

Emit CONTEXT_OVERFLOW *before* you start dropping earlier files to make room.
Silently truncating and answering anyway is the worst outcome: the answer
looks confident, the dropped file was the one that mattered, and nobody finds
out until it ships.
