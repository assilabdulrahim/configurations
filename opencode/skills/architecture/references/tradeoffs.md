# Trade-off analysis

## The table

Score each candidate against the drivers you identified. Do not score
attributes that do not decide anything - padding the table hides the signal.

| Driver (weight) | Option A | Option B | Option C |
|---|---|---|---|
| Latency p99 (high) | | | |
| Operational cost | | | |
| Team can staff it | | | |
| Time to first release | | | |
| Reversibility | | | |
| Failure blast radius | | | |

Write the actual consequence in each cell, not a score out of five.
"Adds a network hop, roughly 15ms" beats "3/5".

## Forces that recur

**Consistency vs availability.** Under partition you pick one. Decide per
data set, not per system. Money and inventory usually need consistency;
feeds, counters and recommendations usually do not.

**Coupling vs duplication.** Shared code couples deploy cycles; duplicated
code drifts. Duplication is cheaper than the wrong abstraction - but say
which you chose and why.

**Sync vs async.** Synchronous is simpler to reason about and to debug.
Asynchronous decouples availability and smooths load, and costs you ordering,
idempotency, and a much harder debugging story. Do not go async for elegance.

**Build vs buy.** Buying costs money and flexibility. Building costs the
thing nobody budgets for, which is operating it for five years.

**Normalise vs denormalise.** Normalised is correct by construction and slow
to read. Denormalised is fast and requires a written answer to "what keeps
these in sync, and what happens when that fails".

**Monolith vs services.** A modular monolith gets most of the boundary
benefit with none of the distributed-systems tax. Start there; extract a
service when a specific, named force demands it.

**Caching.** A cache is a second source of truth with its own consistency
problem. Before adding one, state the invalidation rule and what a stale read
costs the business.

## Quality attributes, and what each actually costs

| Attribute | Bought with | Paid for in |
|---|---|---|
| Low latency | caching, denormalisation, colocation | consistency, memory, complexity |
| High availability | redundancy, multi-region | cost, eventual consistency |
| Strong consistency | consensus, single writer | latency, availability under partition |
| Scalability | statelessness, partitioning | cross-partition queries get hard |
| Security | isolation, least privilege | developer friction, more moving parts |
| Modifiability | indirection, interfaces | more code to read, harder to trace |
| Observability | instrumentation, tracing | throughput, storage cost |

The right column is the half most designs omit. Fill it in.

## Questions that expose a weak design

- What happens when this dependency is slow rather than down? Slow is worse.
- Who owns this data? Which single component writes it?
- How do we roll this back after it has been live for a week?
- What is the blast radius when this fails? Who notices first, and how?
- How does this behave at 10x? At one tenth?
- What does an operator do at 3am when this alarms?
- Which part of this is irreversible?
- What breaks if the team halves?
- What did we assume about load, and where is that written down?
