# Course Portal — Remaining Work, as Self-Contained Prompts

Snapshot date: **2026-07-27**. Repo: `C:\Users\AssilAbdulrahim\source\repos\QuantumReadyDocs` (branch `master`).
Marketing repo: `C:\Users\AssilAbdulrahim\source\repos\365architect`.

Each prompt below is standalone — paste one into a fresh session. They point at files rather than repeating
content, so there is one source of truth.

> **Before running any of them:** a parallel session has been committing to `QuantumReadyDocs`. Always start with
> `git log -5 --format="%h %ci %s"` and `git status` and reconcile before trusting any "already done" claim,
> including the ones in this document.

## Where things actually stand

| # | Workstream | Status | Blocks |
|---|---|---|---|
| A | Finish the citation audit (Phase 4 gate) | 52 of 282 atoms checked, **75% defective** | Everything downstream |
| B | Apply corrections + write audit notes | Not started — **no fixes applied yet** | Phase 5 |
| C | Phase 3 gap: granted-student verification | Only unverified piece of access gating | Phase 5 |
| D | Metadata/numbering cleanup | Not started | — |
| E | Phase 5A: marketing site | **Not started** (no `training.html`, no nav entry) | Needs A+B+C |
| F | Phase 5B: docs `08-ai-security` section | **Not started** | Needs A+B+C |
| G | PQC parity | Bug fixes only; no categories, no expansion, no audit | — |
| H | Accessibility audit | **Never in the plan** — new scope | — |

Uncommitted at snapshot time: `audit/ai-course/**` (new), `tests/.../CourseContentIntegrityTests.cs` (new),
`tests/.../CourseDataStoreTests.cs` (modified). Nothing was committed because a parallel session was active.

---

## Prompt A — Finish the citation audit

```
Read audit/ai-course/README.md in C:\Users\AssilAbdulrahim\source\repos\QuantumReadyDocs — it has the headline
findings, the method, and a coverage table showing exactly what has and has not been checked. Then read
C:\Users\AssilAbdulrahim\.claude\plans\gleaming-wiggling-milner.md for the approved audit design.

Continue Pass A from where the coverage table stops. Remaining: Tier-1 batches 5-6 (24 atoms), all of Tier 2
(73), Tier 5 unresolvable (7), Tier 3 academic (83), Tier 4 house-model (43). Regenerate batch files with
audit/ai-course/make_batches.js (run it from a scratch dir; it reads citation-ledger.json and emits
batch_<TIER>_<n>.md pairing each atom with the claim and answer key it backs).

Keep every control that is already working — they have caught real problems:
- Subagents are READ-ONLY reporters; the orchestrator applies all edits. Max 3 concurrent.
- Seed each batch with 1-2 known-bad citations from README.md's findings without telling the agent. If a batch
  returns VERIFIED on a canary, discard the whole batch and rerun with a different agent.
- Every VERIFIED verdict requires a URL fetched that session plus a quoted span. Recall-based verdicts are
  marked UNVERIFIED-FROM-MEMORY, not VERIFIED.
- Enforce a row-count contract: N atoms in, N rows out. "The rest look fine" is a rejected response.
- Independently re-verify ~10% of VERIFIED rows yourself.

Write per-batch findings to audit/ai-course/batch-<TIER>-<n>.md in the same table format as the existing
batch-T1-*.md files, and update README.md's coverage table as you go.

Do not apply any corrections to course_data.js in this prompt — that is Prompt B.
```

## Prompt B — Apply corrections and write per-module audit notes

```
Read audit/ai-course/README.md and every audit/ai-course/batch-*.md in
C:\Users\AssilAbdulrahim\source\repos\QuantumReadyDocs. Apply the recorded corrections to
src/wwwroot/courses/ai/course_data.js and write the per-module audit notes.

HARD CONSTRAINTS — violating any of these breaks production:
- Never insert, delete, or reorder array entries. cert.ExamAttempts.ModuleIndex persists a raw array position.
  Edit module objects in place only. Preserve the intentional num-13 gap; do NOT renumber to close it.
- No comments inside the object literal — JsonSerializer uses default options (ReadCommentHandling = Disallow)
  and will throw.
- No '{' may appear before `const COURSE_DATA`. CourseDataStore does content.IndexOf('{') across the whole file,
  and the resulting parse failure is swallowed — the course would silently serve nothing.

Several defects are inside MCQ *option text*, not just explanations — notably the "DPIA and FRIA both required"
claim. Fix the option itself, not only the rationale.

Write audit/ai-course/module-15.md … module-27.md. Each note needs a coverage attestation (slides n/n, MCQ n/n,
TF n/n), a findings section using the Was: / Problem: / Evidence: / Now: / Blast radius: block format, and a
"Checked and found correct" section — without that last part a clean module is indistinguishable from an
unaudited one. Give each finding a stable AUD-<module>-<seq> id and a severity
(CRITICAL / HIGH / MEDIUM / LOW).

Afterwards: bump courseInfo.reviewed; add ONE brace-free pointer line to the course_data.js header comment
referencing audit/ai-course/README.md; run `node -e` evaluation of the file to catch trailing commas; run
`dotnet test tests/QuantumReadyDocs.Tests/QuantumReadyDocs.Tests.csproj` (baseline: 84 passed / 2 skipped);
and diff mastery[i].num and .title element-by-element against commit 43f2932 to prove zero insertions,
deletions, or reorders.
```

## Prompt C — Close the Phase 3 verification gap

```
In C:\Users\AssilAbdulrahim\source\repos\QuantumReadyDocs, the access-gating work (Phase 3) is complete except
for one unverified behaviour: that a student WITH an active StudentAccess grant receives the FULL
course_data.js, not the free one-module sample. Anonymous access has already been verified live (returns
exactly specialist[0] with empty mastery); /Account/AccessDenied has been verified to return 200.

DO NOT attempt a real Azure B2C sign-in. The local B2C config points at the real production tenant — that is
why appsettings.json ships Enabled=false.

Instead add a test-only authentication handler (AuthenticationHandler<AuthenticationSchemeOptions> stamping a
fixed email claim), wire it up behind a test-only flag, and drive the app through WebApplicationFactory /
TestServer. Grant the test email via StudentAccessService.GrantAccessAsync against the LocalDB the suite
already uses — see tests/QuantumReadyDocs.Tests/TestFixture.cs, which already calls
InitializeStudentAccessTableAsync. Then assert GET /courses/ai/course_data.js returns the full module set for
the granted user and the 1-module sample for an anonymous request.

Prefer this over a one-off manual check: it leaves durable regression coverage on the actual paywall.
Existing StudentAccessServiceTests.cs already covers grant/revoke/reinstate/expiry at the service layer — what
is missing is the ROUTE-level branch.
```

## Prompt D — Metadata and numbering cleanup

```
In C:\Users\AssilAbdulrahim\source\repos\QuantumReadyDocs\src\wwwroot\courses\ai\course_data.js, fix
student-visible numbering damage left over from the curriculum expansion. The course now has 26 modules
(specialist num 1-9, mastery num 10,11,12,14,15-27 — the gap at 13 is intentional, keep it).

1. metadata.module on modules 1-12 reads "N of 16". The course has 26 modules. Search the whole file rather
   than assuming module 1 is the only one; the same string is duplicated inside slide markdown bodies.
2. Slide heading labels are out of sync with num: num 10 renders "# Module 9 —", num 11 renders "# Module 10 —",
   and num 14 (Capstone) renders "# Module 12 —", which COLLIDES with the real num 12. Two different modules
   currently display a "Module 12" heading.
3. Prerequisite chains skip removed/renumbered modules — e.g. module 15 says "Prerequisites: Modules 1-12",
   omitting 14.
4. The 13 new modules (15-27) lack the metadata.level and metadata."target audience" fields that modules 1-9
   carry. Decide whether to normalize or drop those fields, and be consistent.

Constraints: edit in place only, never reorder or renumber array entries, keep the file valid JSON inside the
wrapper. Run `dotnet test tests/QuantumReadyDocs.Tests/QuantumReadyDocs.Tests.csproj` afterwards.
```

## Prompt E — Phase 5A: marketing site

```
Read C:\Users\AssilAbdulrahim\.claude\plans\what-is-your-suggested-parallel-coral.md — the "Shared Context"
section, then "Phase 5 — Go-to-market linkage", part A. Execute part A only, in
C:\Users\AssilAbdulrahim\source\repos\365architect.

Confirmed current state: there is NO training.html, and js/templates.js SITE_HEADER has no Training or
Certification entry (nav is Home / About Us / Services / AI Audit / Post-Quantum / Methodology / Capabilities /
Self-Assessment / Proof of Execution / Contact Us). Nothing has been done here.

Build the hub page on capabilities.html's card-grid pattern (not post-quantum-audit.html's single-offer
funnel — there are two certifications). CTA routes to contact-us.html, NOT into /courses/, because access is
granted manually through the admin dashboard after payment. Add Course / EducationalOccupationalCredential
JSON-LD following the Service schema block in post-quantum-audit.html.

GATES — do not skip:
- Pricing is not finalized. Use clearly-marked placeholder copy, never invent a number.
- Do NOT add the nav link to the live SITE_HEADER until pricing is confirmed. Build the page; leave it
  unlinked or commented so it cannot go live site-wide by accident.
- Do NOT publish at all until the AI course content is corrected — see audit/ai-course/README.md in the
  QuantumReadyDocs repo. As of 2026-07-27 that content had a 75% citation defect rate and was not publishable.
```

## Prompt F — Phase 5B: docs `08-ai-security` section

```
Read C:\Users\AssilAbdulrahim\.claude\plans\what-is-your-suggested-parallel-coral.md — "Shared Context", then
"Phase 5 — Go-to-market linkage", part B. Execute part B only.

In C:\Users\AssilAbdulrahim\source\repos\QuantumReadyDocs, content/ currently holds 00-365architect through
07-ciphershift365. Add a new top-level section content/08-ai-security/ — NOT nested under
06-brain-nest-365, which is an unrelated product.

Match the voice and structure of content/01-pqc/03-engagement/index.md — read that file directly rather than
guessing the house style. Cover what the certification includes, link to the marketing hub page from Prompt E,
and state the manual qualification process plainly ("apply, access granted after payment") — do not imply
self-serve signup.

The docs engine watches content/ and hot-reloads, so verify by running the app and loading the new section.
Same gate as Prompt E: hold publishing until the course content is corrected.
```

## Prompt G — PQC parity review

```
In C:\Users\AssilAbdulrahim\source\repos\QuantumReadyDocs, the PQC course received only shared bug fixes during
the AI course work. Decide and then execute what parity it should have.

Known gaps:
- pqc/course_data.js has ZERO "category" fields, while pqc/app.js carries the full category-grouping code
  (CATEGORY_LABELS / CATEGORY_ICONS). It degrades to a flat list — guarded at app.js:113 — so nothing is
  broken, but the grouping feature is dead code there.
- PQC content has never been through a fact-check audit. Given the AI course's 13 new modules ran a 75%
  Tier-1 citation defect rate (audit/ai-course/README.md), PQC's FIPS/NIST citations deserve at least a
  sampling pass before anyone assumes they are sound.
- PQC counts: specialist 10 (num 1-10), mastery 6 (num 11-16).

Start by sampling ~15 PQC citations using the same method as the AI audit (audit/ai-course/extract_citations.js
works against any course file) to size the problem before committing to a full pass. Report the sampled defect
rate and recommend scope rather than assuming parity is required.
```

## Prompt H — Accessibility audit (new scope)

```
Run an accessibility audit of the course portal in C:\Users\AssilAbdulrahim\source\repos\QuantumReadyDocs —
src/wwwroot/courses/{ai,pqc}/ (index.html, app.js, style.css) and the /admin/students dashboard, which is built
as an inline HTML string inside src/Program.cs.

NOTE: accessibility was never part of the original 5-phase plan. This is new scope, not a leftover task.

Use the design:accessibility-review skill. Cover WCAG 2.1 AA: colour contrast, keyboard navigation, focus
management, touch-target size, screen-reader semantics, and reduced-motion. Pay particular attention to the
sidebar, which builds nav items as <li role="button" tabindex="0"> with click and keydown handlers rather than
real buttons, and to the quiz/exam interaction flow.

Report findings by severity with concrete fixes. Do not change behaviour without flagging it — the exam flow is
scored server-side and must not be altered as a side effect of markup changes.
```

---

## Suggested order

1. **A → B** — finish the audit and land corrections. Everything else waits on this; the content is not
   currently publishable.
2. **C** — closes the last Phase 3 gap, small and self-contained.
3. **D** — quick, student-visible, independent of the audit.
4. **G** — sizing exercise; may reveal the PQC course needs its own correction pass.
5. **E → F** — go-to-market, only once the content is sound and pricing is set.
6. **H** — before go-live, but not blocking the correction work.
