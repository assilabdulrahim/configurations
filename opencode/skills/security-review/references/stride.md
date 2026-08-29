# STRIDE threat modelling

## Method

1. **Draw the data flow diagram.** Four element types: external entity,
   process, data store, data flow. Then draw the **trust boundaries** -
   process boundaries, network boundaries, the line between authenticated
   and anonymous, between tenants, between your code and a third party.
2. **Apply STRIDE to each element.** Different element types are prone to
   different threats - see the table.
3. **Rate** each threat: impact x likelihood.
4. **Decide** for each: mitigate, transfer, accept, or eliminate. An accepted
   risk needs a named owner and a date. Nothing is left undecided.

## The six categories

| Threat | Violates | Question to ask |
|---|---|---|
| **S**poofing | Authentication | Can someone claim to be another principal? |
| **T**ampering | Integrity | Can data be modified in transit or at rest? |
| **R**epudiation | Non-repudiation | Can someone deny an action they took? |
| **I**nformation disclosure | Confidentiality | Can data reach someone unauthorised? |
| **D**enial of service | Availability | Can someone exhaust a resource? |
| **E**levation of privilege | Authorisation | Can someone gain rights they lack? |

## Which threats apply to which element

| Element | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| External entity | yes | | yes | | | |
| Process | yes | yes | yes | yes | yes | yes |
| Data store | | yes | yes | yes | yes | |
| Data flow | | yes | | yes | yes | |

Processes attract everything. Spend your time there, and on every flow that
crosses a trust boundary.

## Prompts per category

**Spoofing.** How is the caller authenticated? Can a token be replayed,
forged, or used after logout? Is service-to-service traffic authenticated, or
trusted because it is "internal"? Can a user register an identity that
collides with another?

**Tampering.** Is anything security-relevant sent to the client and trusted
on return - prices, roles, quantities, IDs? Can a message on a queue be
altered? Is there integrity protection on stored data that matters? Can a
build artifact or dependency be swapped?

**Repudiation.** Are security-relevant actions logged with actor, action,
target and time? Can the actor edit or delete those logs? Are logs exported
somewhere the actor cannot reach?

**Information disclosure.** What appears in error messages, stack traces and
debug endpoints? Do logs contain tokens, personal data, or payloads? Can one
tenant read another tenant data? Is there an enumeration oracle - different
responses or timings for "user exists" versus "wrong password"? What does
the storage layer expose if the disk or backup leaks?

**Denial of service.** Any unbounded input - request body, page size, upload,
recursion depth, regex? Are there rate limits per principal, not just
globally? Can one tenant exhaust a shared pool? What happens when a
downstream dependency is slow rather than down? Is there a queue with no
maximum depth?

**Elevation of privilege.** Is authorisation checked on every path, including
ones added later? Is object-level authorisation enforced, or only endpoint
level? Can a parameter change select another user object? Are admin functions
protected by more than an unlinked URL? Can a lower environment reach a
higher one?

## Trust boundaries worth drawing explicitly

- Internet to edge
- Edge to application
- Application to data store
- Between services, even inside one VPC
- Between tenants in shared infrastructure
- Between environments
- Your code and any third-party library, SaaS or webhook
- Human operator and production
- CI/CD pipeline and production - increasingly the most attacked path

## Output

```
THREAT-<n>: <one-line description>
  ELEMENT:    <which element or flow>
  CATEGORY:   <STRIDE letter>
  SCENARIO:   <how it plays out, concretely>
  IMPACT:     high | medium | low - <what is lost>
  LIKELIHOOD: high | medium | low - <why>
  DECISION:   mitigate | transfer | accept | eliminate
  CONTROL:    <the specific mitigation, or the accepting owner and date>
```
