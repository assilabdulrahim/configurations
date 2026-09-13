# Spec rubric

The six criteria that replace test execution as ground truth when the
deliverable is a specification.

Each is mechanically checkable. That is the whole design constraint: a
criterion that requires judgement can be argued with, and anything that can be
argued with will be argued with by a model that wants to pass.

---

## 1. Traceability

**Rule.** Every requirement traces to a numbered goal in `OBJECTIVE.md`.

**Check.** For each requirement id, a `traces to` value naming a goal.

**Fails.** Any requirement with no trace. These are orphans — scope that
entered without a decision.

---

## 2. Acceptance tests

**Rule.** Every functional requirement names how it will be verified.

**Check.** Non-empty `acceptance test` naming (a) what is observed and (b)
what value constitutes a pass.

**Passes.** `POST /v1/scan with a 40MB SBOM returns 200 and a valid
CycloneDX 1.6 document; validated with cyclonedx-cli validate --strict`

**Fails.** `Scanning works.` · `Verified manually.` · `Tests pass.`

---

## 3. Non-contradiction

**Rule.** No two requirements conflict.

**Check.** Pairwise across non-functional targets, and each constraint against
the chosen approach.

**Common conflicts.** Latency vs. consistency · offline vs. real-time sync ·
zero-downtime deploy vs. blocking migrations · data residency vs. managed
service region · full audit log vs. right-to-erasure.

---

## 4. Falsifiability

**Rule.** No requirement uses an unquantified subjective term.

**Check.** Scan for: *fast, slow, intuitive, simple, easy, scalable, robust,
secure, reliable, seamless, modern, clean, efficient, user-friendly,
performant, lightweight, flexible, minimal, comprehensive*. Every occurrence
needs a number or a named standard.

**Passes.** `P95 response under 400ms at 50 concurrent users` ·
`Meets WCAG 2.1 AA` · `Recovers within 30s of primary failure`

**Fails.** `Fast response times` · `Intuitive interface` · `Highly scalable`

This is the criterion that fails most often and matters most. Unfalsifiable
requirements cannot be built to and cannot be tested against — they are
decoration that survives review because nobody can object to them.

---

## 5. Dependencies

**Rule.** Every external dependency named with a version or version range.

**Check.** Runtimes, frameworks, libraries, services, APIs, standards.

**Passes.** `PostgreSQL 16+` · `Python 3.11–3.13` · `CycloneDX 1.6` ·
`.NET 8 LTS`

**Fails.** `A database` · `Latest Node` · `A cloud provider`

---

## 6. Bounded scope

**Rule.** The out-of-scope list is non-empty and specific.

**Check.** At least three concrete entries naming things a reasonable person
might otherwise expect.

**Passes.** `No multi-tenancy` · `No mobile client` · `No SSO in v1` ·
`English only`

**Fails.** Empty · `Anything not listed above` · `Future enhancements`

---

## Scoring

All six pass, or the spec is `NEEDS_WORK`. No partial credit, no averaging.

## Extending this

If the evaluator's *Not covered by the rubric* section flags the same issue
across three or more projects, it is a candidate criterion. Add it only if it
can be checked mechanically. A rubric of judgement calls is not a rubric.

Query recurrence:

```sql
SELECT finding, COUNT(DISTINCT project) AS projects, SUM(occurrences) AS hits
FROM lesson
WHERE stage = 'spec-eval' AND category = 'rubric-gap'
GROUP BY finding HAVING projects >= 3
ORDER BY hits DESC;
```
