---
name: cloud-architecture
description: Design or review cloud infrastructure - topology, networking, identity, resilience, cost and IaC. Covers Azure, AWS and GCP. Use for infrastructure decisions, capacity planning, well-architected reviews and Terraform/Bicep work.
license: MIT
compatibility: opencode
---
## When to use

Anything about how a system is hosted: topology, networking, identity,
data stores, scaling, disaster recovery, cost, or the IaC that expresses it.

For application-internal structure use the `architecture` skill instead.
For threat modelling use `security-review`.

## Workflow

1. **Establish the ground truth.** Which cloud, which subscriptions or
   accounts, which regions, what already exists. Read the existing IaC before
   proposing anything. If there is no IaC, say so - that is finding number
   one.
2. **Capture the requirements that actually shape infrastructure:**
   - RTO and RPO. These decide the DR topology and most of the cost.
   - Availability target, stated as a number. "High" is not a target.
   - Traffic shape: steady, diurnal, spiky, batch. Peak-to-mean ratio.
   - Data residency, sovereignty, and retention obligations.
   - Compliance regime, if any.
   - Budget - a monthly ceiling, not a vibe.
   - Who operates it, and at what hours.
3. **Design against the pillars** in `references/well-architected.md`. Walk
   all six; note explicitly where you are trading one for another.
4. **Diagram the topology.** Regions, zones, network boundaries, data flows,
   and where identity is enforced. See the `architecture` skill for Mermaid.
5. **Cost it.** An order-of-magnitude monthly figure with the three largest
   line items named. Say which assumptions drive it.
6. **Then write IaC** - never before the design is agreed.

## Rules

- **RTO and RPO drive the design.** Ask for them first. A 5-minute RPO and a
  24-hour RPO produce completely different systems at completely different
  prices. Do not guess these.
- **Managed over self-hosted** unless there is a stated reason. The cost of
  running your own database is not the VM, it is the person.
- **Identity is the perimeter.** Managed identities and workload identity
  federation over secrets, everywhere. If a connection string exists in a
  config file, that is a finding.
- **Private by default.** Private endpoints, no public data-plane exposure,
  egress controlled and logged. Justify every public IP.
- **Least privilege, scoped narrowly.** Role assignments at the smallest
  scope that works. Wildcard actions or `*` resources are a finding.
- **Everything in IaC.** A resource created in a portal will be deleted by
  someone who does not know it exists. Portal changes are incidents waiting.
- **Tag everything** with owner, environment, cost-centre and data
  classification. Untagged resources become nobody's, then permanent.
- **Multi-region is expensive.** Do not propose it without an RTO that
  requires it. Multi-zone covers most availability targets for a fraction of
  the cost and complexity.
- **Design the bill.** Egress, cross-zone traffic, idle provisioned capacity,
  log ingestion and premium SKUs are what actually surprise people. Name them.
- **State what you did not verify.** Quota limits, SKU availability in a
  region and current pricing change constantly. Label them `UNVERIFIED` and
  say where to check rather than asserting a number.

## Infrastructure as code

- Match the existing tool. Do not introduce Terraform into a Bicep estate.
- Modules with narrow, typed inputs. No hardcoded subscription IDs, region
  names or secrets.
- Remote state with locking and encryption. State is a credential - treat it
  like one.
- Separate state per environment. One blast radius per environment.
- `plan` output goes in the PR. A merge without a reviewed plan is a change
  nobody reviewed.
- Name a rollback for every change. "Re-apply the previous commit" only works
  if the resource is not stateful; say when it is not.

## Reviewing existing infrastructure

Report findings ordered by blast radius, each as:
`resource - risk - what an attacker or outage does with it - remediation`.

Check the fast list in `references/review-checklist.md` first - it catches
the common, high-severity misconfigurations.
