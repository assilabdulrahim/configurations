---
name: changelog
description: Draft a changelog and propose a semantic version bump from merged changes since the last git tag. Use when preparing a release.
license: MIT
compatibility: opencode
---
## Workflow

1. Run `git describe --tags --abbrev=0` to find the previous tag.
2. Summarize merged changes since that tag, grouped as Added / Changed / Fixed / Removed.
3. Propose a semantic version bump (major / minor / patch) and state why.
4. Wait for explicit approval before writing files or creating tags.

## Rules

- Do not invent changes. List only what appears in the git history.
- If the versioning scheme is unclear, ask before proposing a bump.

## Bundled files (optional)

You can drop supporting files next to this SKILL.md and reference them
by relative path, e.g. `references/release-policy.md` or `scripts/notes.ts`.
