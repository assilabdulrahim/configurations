---
name: security-review
description: Threat model a design or security-review code and dependencies - STRIDE, OWASP Top 10, authn/authz, secrets, injection and supply chain. Use before shipping anything that handles untrusted input, credentials, money or personal data.
license: MIT
compatibility: opencode
---
## When to use

- Reviewing a diff, a service, or a whole codebase for vulnerabilities
- Threat modelling a design before it is built
- Auditing authentication, authorisation, or a data-handling path
- Assessing dependency and supply-chain risk

This skill is for defensive work: finding and fixing weaknesses in systems
you are authorised to review.

## Workflow

### Reviewing code

1. **Map the attack surface first.** Every entry point where untrusted data
   arrives: HTTP handlers, message consumers, webhooks, file uploads, CLI
   arguments, environment, deserialization, and anything reading a database
   another system writes.
2. **Trace each input to its sink.** Follow the data. A finding is real when
   you can name the source, the sink, and the missing control between them.
3. **Work the checklist** in `references/owasp.md` against the surface you
   mapped.
4. **Verify before reporting.** Read the code path end to end. A framework
   may already neutralise what looks like a bug - check whether it does here,
   in this configuration, on this version.
5. **Report** in the format below, ordered by severity.

### Threat modelling a design

1. Draw the data flow: processes, stores, flows, external entities, and the
   **trust boundaries** between them.
2. Apply STRIDE per element - see `references/stride.md`.
3. Rate each threat by impact and likelihood.
4. Name the mitigation, or accept the risk explicitly with an owner. An
   unmitigated, unaccepted threat is an open item, not a closed one.

## Rules

- **Verify, do not pattern-match.** A string that looks like concatenated SQL
  may be a parameterised call two frames up. Read the path. Unverified
  suspicion is reported as a question, not as a finding.
- **Trust boundaries are where bugs live.** Enumerate them explicitly.
  Anything crossing one is untrusted, including data from your own other
  service.
- **Validate on the server, allowlist not blocklist.** Client-side validation
  is a usability feature. Blocklists are always incomplete.
- **Authentication is not authorisation.** For every endpoint ask: who may
  call it, and *which specific records* may they touch? Missing object-level
  authorisation is the single most common serious flaw in real applications.
- **Never invent a CVE, a version, or an advisory.** If you cannot verify a
  vulnerability against the actual lockfile, say `UNVERIFIED` and say how to
  check.
- **Severity reflects exploitability and impact**, not how easy it is to fix.
- **No exploit code.** Describe the vulnerability, the impact, and the fix.
  A proof of concept is a request for the maintainer, not a deliverable here.
- **Report secrets immediately.** A committed credential is a live incident:
  stop, report it, and say that rotation is required. Removing it from the
  latest commit does not remove it from history and does not un-leak it.

## Report format

```
<path:line>
  TITLE:      <short description>
  SEVERITY:   critical | high | medium | low | info
  CATEGORY:   <OWASP or CWE reference>
  IMPACT:     <what an attacker achieves>
  TRIGGER:    <the specific input or condition>
  FIX:        <the concrete change>
  CONFIDENCE: confirmed (traced end to end) | probable | needs verification
```

Finish with:
- A one-line verdict: `SECURITY: PASS` or `SECURITY: BLOCKING ISSUES FOUND`
- What you reviewed, and just as importantly **what you did not** - the
  scope you could not cover is part of an honest result.

## Anti-patterns in security reviews

- A long list of low-severity style findings that buries the one real bug.
- Reporting framework defaults as vulnerabilities without checking the config.
- "Add input validation" with no statement of what is valid.
- Claiming a dependency is vulnerable without reading the lockfile version.
- Passing a review on code you did not fully read. Say what you skipped.
