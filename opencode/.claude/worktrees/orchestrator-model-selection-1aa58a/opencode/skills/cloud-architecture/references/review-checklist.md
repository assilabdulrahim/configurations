# Fast infrastructure review checklist

High-severity misconfigurations, ordered by how often they are the cause of
an actual incident. Check these before the deeper pillar review.

## Exposure

- [ ] Storage buckets or blob containers with public or anonymous read
- [ ] Databases with a public endpoint, or a firewall rule of `0.0.0.0/0`
- [ ] Management ports (22, 3389, 5985) open to the internet
- [ ] Kubernetes API server publicly reachable with no authorised-IP range
- [ ] Admin, metrics or debug endpoints exposed without authentication
- [ ] Internal load balancers accidentally provisioned as public

## Identity and secrets

- [ ] Connection strings, keys or tokens in IaC, config files, or CI variables
      that are not marked secret
- [ ] Long-lived static credentials where a managed or federated identity
      would work
- [ ] Role assignments with wildcard actions, or scoped at subscription or
      account root when a resource group would do
- [ ] Service principals with `Owner` or `Contributor` at subscription scope
- [ ] No key rotation, or rotation that has never actually run
- [ ] Terraform or Bicep state stored unencrypted, or in a publicly listable
      location. State contains secrets.

## Data

- [ ] Encryption at rest not enabled
- [ ] TLS not enforced, or TLS below 1.2 permitted
- [ ] Backups not configured, or configured and never restore-tested
- [ ] Soft delete and purge protection disabled on vaults and storage
- [ ] Retention shorter than the compliance obligation, or unbounded with no
      lifecycle rule
- [ ] Production data present in a non-production environment

## Resilience

- [ ] Single-zone deployment where the availability target implies multi-zone
- [ ] One NAT gateway, one firewall, or one build agent as a hidden SPOF
- [ ] No health probes, or probes that only check process liveness
- [ ] Retries with no backoff, no jitter, or no ceiling
- [ ] No timeouts on outbound calls - the most common cause of cascading
      failure
- [ ] Certificates or domains with no expiry monitoring

## Operations

- [ ] Resources created outside IaC, or drift never detected
- [ ] Audit or diagnostic logging disabled
- [ ] Logs stored only in the account they describe, so an attacker can erase
      them
- [ ] No budget alert
- [ ] Untagged resources, so no owner and no cost attribution
- [ ] No environment separation, or shared state across environments

## Cost

- [ ] Non-production running 24/7
- [ ] Orphaned disks, snapshots, public IPs, load balancers
- [ ] Premium SKUs selected by default rather than by requirement
- [ ] Log ingestion unbounded and unsampled
- [ ] Cross-region or cross-zone chatter on a hot path
- [ ] Provisioned throughput sized for a peak that never occurs

---

## Reporting format

```
<resource or module path>
  RISK:        <what is wrong>
  EXPLOIT:     <what an attacker or an outage does with it>
  SEVERITY:    critical | high | medium | low
  REMEDIATION: <the specific change, in IaC terms>
```

Order by blast radius, not by how easy the fix is. Say plainly which findings
you verified against the actual configuration and which are inferred from the
IaC without seeing the deployed state.
