# Document templates

Section skeletons. Follow the order; drop a section only with a stated reason.

## Design doc / RFC
```
# <What this proposes, as a statement not a topic>
Status: draft | in review | accepted | superseded by <link>
Author: <name>   Date: <YYYY-MM-DD>

## Summary
The proposal in three sentences. A reader who stops here knows what changes.

## Problem
What is broken or missing, with evidence. Numbers and path:line citations.
Who is affected and how much it costs to leave it alone.

## Goals / Non-goals
Explicit non-goals prevent scope arguments later. Include them.

## Proposal
The design. Diagram first, then the mechanism, then the interfaces.

## Alternatives considered
One subsection each: what it was, why it was rejected. Be fair to them.

## Risks and mitigations
What could go wrong, how likely, what you would do about it.

## Migration / rollout
Steps, order, and the rollback for each. If it cannot roll back, say so.

## Open questions
Numbered, each with an owner.
```

## ADR (Architecture Decision Record)
Short and immutable. Never edit an accepted ADR - supersede it.
```
# ADR-<NNN>: <decision, in the imperative>
Status: proposed | accepted | superseded by ADR-<NNN>
Date: <YYYY-MM-DD>

## Context
The forces at play. What made a decision necessary now.

## Decision
"We will ..." - one paragraph, unambiguous.

## Consequences
What becomes easier. What becomes harder. What is now locked in.
Both columns are required; an ADR with only benefits is not honest.
```

## Runbook
Written for someone tired at 3am who did not build the system.
```
# Runbook: <the alarm or symptom>

## Symptom
What the operator sees. Exact alert text or error string.

## Severity and impact
Who is affected, and what is degraded versus down.

## Diagnosis
Numbered steps. Each step: the command, and what each outcome means.

## Resolution
Numbered steps, copy-pasteable. Mark any destructive step clearly.

## Rollback
How to undo the resolution if it makes things worse.

## Escalation
Who to wake, and after how long.

## Related
Dashboards, past incidents, the code path.
```

## README
```
# <Project>
One sentence: what it does and who it is for.

## Quick start
The shortest path from clone to running. Must actually work on a clean
machine - verify it, do not assume it.

## How it works
A paragraph and a diagram. Enough to orient, not a design doc.

## Configuration
Table: name, default, effect. Every setting that exists.

## Development
Build, test, lint. The exact commands.

## Troubleshooting
The three failures newcomers actually hit.
```

## Incident report
Blameless. The system permitted the error; find out how.
```
# Incident: <what broke> - <YYYY-MM-DD>
Duration: <detection time> to <resolution time>
Impact: <who, what, how much>

## Timeline
UTC timestamps. What happened and what was known at the time - not what
was known afterwards.

## Root cause
The chain, not a single culprit. Keep asking why until you reach something
systemic.

## What went well / what did not
Detection, diagnosis, communication, mitigation.

## Action items
Table: action, owner, due date, tracking link. No item without an owner.
```
