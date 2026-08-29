# Well-Architected pillars

Six pillars. Walk all of them; note where one is traded for another. The
trade note is the valuable part - a design that claims to maximise all six is
not a design.

## 1. Reliability

- What is the stated availability target, as a number? Derive the topology
  from it, not the other way round.
- RTO (how long to recover) and RPO (how much data may be lost). Every DR
  decision follows from these two figures.
- Single points of failure: enumerate them. Include the ones people forget -
  DNS, certificates, a single NAT gateway, one build agent, one person.
- Zone redundancy first; region redundancy only when RTO demands it.
- Health probes that check dependencies, not just process liveness.
- Retry with exponential backoff **and jitter**. Retry storms cause the
  outage they were meant to survive.
- Idempotency on every write path that can be retried.
- Graceful degradation: what still works when the least important dependency
  is down?
- Backups are a claim until a restore is tested. When was the last restore
  drill, and how long did it take?

## 2. Security

- Identity as the perimeter: managed identity or workload identity
  federation. Secrets only where nothing else is possible.
- Secrets in a vault with rotation. Never in config, env files, or IaC.
- Private endpoints; no public data-plane. Justify every public IP.
- Network segmentation with default-deny, and controlled, logged egress.
- Encryption at rest and in transit. Customer-managed keys only if a
  compliance rule requires them - they add real operational burden.
- Least privilege at the narrowest workable scope. No wildcard actions.
- Audit logging enabled, exported off the account, and immutable.
- A patching story for everything you own, including base images.

## 3. Cost optimisation

- A monthly ceiling and a budget alert that reaches a human.
- Right-size from measurements, not from the default SKU.
- Reserved capacity or savings plans for steady baseline load; on-demand for
  the spiky part.
- Autoscale down as aggressively as up - most estates only scale one way.
- Lifecycle policies on storage and log retention. Log ingestion is the most
  commonly underestimated line item.
- Non-production environments stop outside working hours.
- The usual surprises: cross-region egress, cross-zone traffic, idle
  provisioned throughput, premium SKUs chosen by default, orphaned disks and
  public IPs, NAT gateway data processing.

## 4. Operational excellence

- Everything in IaC, deployed by a pipeline, reviewed as code.
- Deployments are automated, repeatable and reversible. Name the rollback.
- Every alert is actionable and maps to a runbook. An alert nobody acts on
  trains people to ignore alerts.
- Structured logs with a correlation ID that survives every hop.
- Distributed tracing on anything with more than two services.
- Dashboards showing the four golden signals: latency, traffic, errors,
  saturation.
- Blameless post-incident review with tracked, owned actions.

## 5. Performance efficiency

- Measure before optimising. State the current p50, p95 and p99.
- Set a latency budget per hop and hold the design to it.
- Choose the data store for the access pattern, not for familiarity.
- Cache with a written invalidation rule and a stated staleness tolerance.
- Async and queue-based load levelling for spiky, non-interactive work.
- Load test at expected peak and at 2x. Know where it breaks and how.

## 6. Sustainability

- Right-sizing and scale-to-zero are the same lever as cost.
- Region choice affects carbon intensity as well as latency and residency.
- Delete what nothing reads. Old data has a running cost.

---

## Trade-offs to state explicitly

| Choosing | Costs you |
|---|---|
| Multi-region active-active | Cost, and eventual consistency you must design around |
| Strong consistency | Latency, and availability under partition |
| Serverless | Cold starts, execution limits, harder local development |
| Managed services | Money, and lock-in |
| Self-hosted | An operations burden and a patching obligation, forever |
| Aggressive autoscaling | Cold-start latency at the front of a spike |
| Long log retention | A storage bill that grows without anyone deciding to |
