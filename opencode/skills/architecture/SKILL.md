---
name: architecture
description: Design or review software architecture - component decomposition, boundaries, data flow, trade-off analysis, C4 diagrams and ADRs. Use for structural decisions, not for writing feature code.
license: MIT
compatibility: opencode
---
## When to use

A structural decision is on the table: how to split a system, where a
boundary goes, which pattern applies, whether to extract a service, how data
flows. Also use it to review an architecture that already exists.

Do not use it to implement a feature inside an existing structure.

## Workflow

1. **Establish constraints before designing.** You cannot evaluate a design
   without them. Capture these, and state as assumptions anything you were
   not told:
   - Scale: requests/sec, data volume, growth rate
   - Latency budget, and availability target
   - Team size and shape - architecture a team cannot staff is wrong
   - Existing stack, and what cannot change
   - Compliance, data residency, retention
   - Budget and deadline
2. **Map what exists.** For a brownfield system, read it before proposing.
   Produce a C4 Context and Container view of the current state first. Most
   bad architecture proposals are bad because they describe a system that
   does not exist.
3. **Identify the real drivers.** Which two or three quality attributes
   actually decide this? A design optimised for everything is optimised for
   nothing.
4. **Produce two or three candidate designs.** One is not a decision, it is
   a preference. Include the boring option - it often wins.
5. **Compare against the drivers** using the table in
   `references/tradeoffs.md`. Be explicit about what each option costs.
6. **Recommend one, with reasoning.** Name the conditions that would change
   the recommendation.
7. **Write it up** as an ADR (see the `document` skill) plus a C4 diagram.

## Rules

- **Constraints before solutions.** If you cannot state the scale and the
  latency budget, you are guessing. Say so and ask.
- **Boundaries follow change, not nouns.** Split where things change for
  different reasons and at different rates - not by entity name, not by
  layer. If two components always change together, they are one component.
- **Name the coupling.** Every boundary is a contract someone pays for.
  State what crosses it and what happens when it breaks.
- **Distributed is a cost, not a goal.** Network calls fail, retry, duplicate
  and reorder. Do not distribute unless something specific forces it:
  independent scaling, independent deploy cadence, team autonomy, or a
  compliance boundary. "Microservices" is not a driver.
- **Data ownership is the hard part.** One writer per piece of data. If two
  services write the same row, they are one service wearing a costume.
- **State where consistency is required** and where eventual is acceptable.
  That is a business question. Do not decide it silently.
- **Design the failure modes.** For each dependency: what happens when it is
  slow, when it is down, when it returns wrong data. Timeouts, retries with
  backoff and jitter, circuit breakers, idempotency keys, dead letters.
- **Prefer reversible decisions.** Optimise for the ability to change your
  mind. Flag irreversible ones loudly - those deserve the deep analysis.
- **Do not invent load figures.** Without numbers, label them as assumptions
  and state the range over which the design holds.

## Diagrams

Use C4 in Mermaid. Levels 1 and 2 are almost always enough; go to level 3
only for the component that carries the risk. See `references/c4.md`.

## Reviewing an existing architecture

Report as: what it does well, then risks ordered by blast radius, then what
you would change first and why.

Distinguish "wrong" from "not how I would have done it". Only the first is a
finding. Consistency with the existing system beats your preference.
