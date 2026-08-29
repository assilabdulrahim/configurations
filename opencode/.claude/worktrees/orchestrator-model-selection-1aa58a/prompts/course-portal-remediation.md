# Remediation Handoff — AI Course Portal

Self-contained. Everything needed is below; no prior session context required.

---

## Context

Repo: `C:\Users\AssilAbdulrahim\source\repos\QuantumReadyDocs` (branch `master`).
The AI course portal at `docs.365architect.com/courses/ai/` has 26 modules in
`src/wwwroot/courses/ai/course_data.js` — a `.js` file wrapping
`const COURSE_DATA = { courseInfo, specialist: [...], mastery: [...] }`.

A fact-check audit of the 13 newest modules (mastery `num` 15–27) ran and is recorded in `audit/ai-course/`.
It found a **75% defect rate in Tier-1 regulatory citations**. A follow-up remediation round then ran, which
applied *some* fixes, added tests and pages — and **introduced a serious regression**.

A validation pass on 2026-07-28 found what follows. All of it is evidence-backed; re-verify anything you doubt.

**Start by confirming the current state**, since other sessions may have committed since:
```
cd C:\Users\AssilAbdulrahim\source\repos\QuantumReadyDocs
git log -8 --format="%h %ci %s"
git status
```

---

## Hard constraints — violating any of these breaks production

- **Never insert, delete, or reorder entries in the `specialist`/`mastery` arrays.**
  `cert.ExamAttempts.ModuleIndex` persists a raw array position and is re-resolved against the live file later.
  Edit module objects **in place** only.
- **Preserve the intentional gap at `num` 13.** Correct sequences are `specialist: 1–9` and
  `mastery: 10,11,12,14,15…27`. Do **not** renumber to close the gap.
  `CourseDataStore.ValidateModuleOrder` only requires `num` to be strictly increasing per track, so gaps are legal.
- **No comments inside the object literal.** `JsonSerializer` runs with default options
  (`ReadCommentHandling = Disallow`) and will throw.
- **No `{` may appear before `const COURSE_DATA`.** `CourseDataStore` does `content.IndexOf('{')` across the
  whole file; a brace in the header comment makes the parse fail, and **the exception is swallowed** — the course
  silently serves nothing. A regression test already guards this.
- **Write the file as UTF-8 without BOM.** See Task 1 — this is exactly what already went wrong once.

---

## Task 1 — Restore the corrupted encoding (BLOCKING, do this first and alone)

Commit `8bb3475` ("Redesign") rewrote `src/wwwroot/courses/ai/course_data.js` with a non-UTF-8 encoding,
destroying **all 1,228 non-ASCII characters** — 722 em-dashes and 35 en-dashes became literal `?`.

| version | non-ASCII | em-dash | en-dash | `?` |
|---|---|---|---|---|
| `43f2932` … `bb8f26d` (clean) | 1228 | 722 | 35 | 465 |
| `8bb3475` → HEAD (corrupt) | **0** | **0** | **0** | **1457** |

It is student-visible on every module — titles currently render as
`365 Architect ? AI Security Specialist` and `Module 16 ? Global AI Regulations & Compliance`.
Only this one file is affected; `pqc/course_data.js` still has 1,043 non-ASCII characters.

**Do not attempt to repair in place by mapping `?` back to dashes.** The baseline legitimately contains 465 real
question marks, so `?` is ambiguous. Restore and replay instead:

1. `bb8f26d` holds the last clean copy. `8bb3475` is the only commit that touched this file afterwards, so
   HEAD's copy == `8bb3475`'s copy.
2. Extract both:
   ```
   git show bb8f26d:src/wwwroot/courses/ai/course_data.js > /tmp/clean.js
   git show HEAD:src/wwwroot/courses/ai/course_data.js     > /tmp/corrupt.js
   ```
3. Make a *folded* copy of the clean file — replace every `\u2014` and `\u2013` with `?` — so it matches the
   corrupt file's character set. Diff **folded-clean vs corrupt**. What remains is exactly the set of *semantic*
   edits `8bb3475` made, with the encoding noise removed.
4. Re-apply only those semantic edits onto the **unfolded** clean file. These edits are wanted — they include
   real corrections (Article 111, *United States v. Kurbo*, *In the Matter of Everalbum*, SB 26-189, the
   social-scoring "public or private actors" fix) and the removal of the stale `of 16` module counts.
5. Write the result as **UTF-8 without BOM**.

Verify before moving on — all must hold:
```
node -e "const fs=require('fs');const t=fs.readFileSync('src/wwwroot/courses/ai/course_data.js','utf8');
console.log('em',(t.match(/\u2014/g)||[]).length,'en',(t.match(/\u2013/g)||[]).length,
'FFFD',(t.match(/\uFFFD/g)||[]).length,'spaceQ',(t.match(/ \? /g)||[]).length);
new Function(t+'; return COURSE_DATA;')();console.log('parses OK');"
```
Expect roughly `em 722 / en 35`, `FFFD 0`, **`spaceQ 0`**, and `parses OK`.

**Add a permanent guard** to `tests/QuantumReadyDocs.Tests/CourseContentIntegrityTests.cs` so this cannot recur:
assert that neither course file contains U+FFFD, and that it contains **no occurrence of `" ? "`
(space–question-mark–space)**. That sequence is the signature of a flattened dash and never occurs in legitimate
prose — a real question mark is preceded by a word character. Run it over both `ai` and `pqc`.

Commit this on its own, before any content edits.

---

## Task 2 — Apply the audit corrections that were documented but never made

`audit/ai-course/module-15.md` … `module-27.md` record findings as `AUD-<module>-<n>`. Several were written up
but never applied to `course_data.js`. Verified still present at HEAD:

| Finding | Severity | Evidence still in the file |
|---|---|---|
| **AUD-16-1** | **CRITICAL** | Explanation still reads *"both assessments are **legally required**"*; citation still *"EU AI Act Arts. 9 and 27"* and *"Art. 9+27"* |
| AUD-16-6 | HIGH | `Title VIII` ×1 |
| L-008 (module 16/26) | HIGH | `EDPB Opinion 06/2014` ×2 |
| L-006/L-007 | MEDIUM | `WP251rev.01` ×4, still attributed to EDPB |
| L-024/L-025/L-026 | MEDIUM | `WP248` ×2, still attributed to EDPB |
| L-018 | MEDIUM | PIPL `Articles 36-40` ×1 |
| L-027/L-037 | HIGH | `Art. 10(5)` never added (0 occurrences) |

**AUD-16-1 is the priority.** Two independent reviewers flagged it as legally false. EU AI Act Art 27 (FRIA)
binds only (a) public bodies, (b) private entities providing public services, and (c) Annex III 5(b)/(c)
deployers — so "both always required" is wrong for most private-sector deployers, and a student could act on it.
Art 9 is a *provider* risk-management duty, not an impact assessment.

Note the failure mode from last round: the MCQ **option** was softened but the **explanation** was left carrying
the false claim. Fix **every** surface — option text, explanation, and `Source:` line — at all sites:
`M16#mcq9`, `M16#tf7`, `M26#tf2`.

Correct attributions to use:
- WP251rev.01 / WP248 → **Article 29 Working Party** (adopted), *endorsed* by the EDPB 25 May 2018. WP248 must
  carry `rev.01`; without it the citation points at the superseded April 2017 text.
- `EDPB Opinion 06/2014` → **Article 29 Working Party, Opinion 06/2014 (WP 217, 9 Apr 2014)**, which interprets
  **Art 7 of Directive 95/46/EC** — not GDPR. For a GDPR-era claim cite **EDPB Guidelines 1/2024** instead.
- PIPL cross-border → **Arts 38–43**; foreign law-enforcement requests → **Art 41**.
- `Title VIII` → the final Regulation has **Chapters I–XIII**, no Titles. For that slide's actual content cite
  **Art 6 and Annex III; Art 43**.

Work module by module, and for each finding you apply, tick it off in that module's note.

---

## Task 3 — Finish the incomplete Prompt-D cleanup

Numbering defects that survived the last round:

1. **Duplicate slide heading.** `num` 12 and `num` 14 (Capstone) *both* render `Module 12 — …`. Two different
   modules display the same label.
2. **Off-by-one headings.** `num` 10 renders `Module 9 — …`; `num` 11 renders `Module 10 — …`.
3. **Inconsistent `metadata.module`.** The stale `of 16` counts were *deleted* rather than corrected, and the
   field now exists only on modules 1–9 and 12 — absent on 10, 11, and 14–27. Pick one convention and apply it
   uniformly (either populate all 26 correctly against a 26-module course, or drop the field everywhere).
4. **Prerequisite chains** still skip removed/renumbered modules — e.g. module 15 says "Prerequisites: Modules
   1–12", omitting 14.

Change display text only. Do not touch `num` values or array order.

---

## Task 4 — Resolve the half-finished PQC categorization

`pqc/course_data.js` has **1 of 16** modules tagged (`num` 1 → `"pqc"`). Because `buildSidebar()` renders a
header only for non-empty categories, this produces one labelled module and fifteen orphans — worse than the
clean flat list it had before.

Also note `ValidCategories` in `CourseContentIntegrityTests.cs` was widened to include `"pqc"`, which made the
test *accept* the half-done state rather than catch it.

Pick one and finish it:
- **Revert** — strip the single `category` from `num` 1, restoring the clean flat sidebar, and remove `"pqc"`
  from `ValidCategories`; or
- **Complete** — tag all 16 PQC modules with meaningful categories (a single `"pqc"` bucket for everything adds
  nothing; use real groupings), and keep the test value.

Then make the test enforce whichever you chose — e.g. an all-or-nothing assertion per course, so a partial
tagging fails rather than passes.

---

## Task 5 — Correct the audit README, which now misreports state

`audit/ai-course/README.md` is stale and misleading in **both** directions. It currently claims:
- *"**No corrections have been applied to `course_data.js` yet.** Every finding below is recorded but unfixed."*
  — false; several were applied.
- Tier 1 *"52 of 76 checked (batches 1–4). Batches 5–6 outstanding"* — false; `batch-T1-5.md` and
  `batch-T1-6.md` exist.
- Tier 2 *"Not started"* — false; `batch-T2-1.md` and `batch-T2-2.md` exist.
- *"Per-batch detail: batch-T1-1 … batch-T1-4"* — there are 8 batch files.

Rewrite the coverage table from what is actually on disk, and add a short "corrections applied" section stating
plainly which findings are fixed and which remain open. Anyone reading this file should get an accurate picture
without opening the data.

---

## Task 6 — Finish the audit itself (~62% still unverified)

Roughly **106 of 282 citation atoms** have been checked. Outstanding:

| Scope | Atoms | Status |
|---|---|---|
| Tier 2 batches 3–5 (ISO, IEEE, NIST, COSO, MITRE) | ~43 | not started |
| Tier 5 unresolvable (Gartner, SANS, NACD, FDA SaMD) | 7 | not started |
| Tier 3 academic attributions | 83 | not started |
| Tier 4 house pedagogical models | 43 | not started |
| Pass B/C — answer keys + slides | 137 questions, 70 slides | not started |
| Pass D — cross-module contradictions | 3 pairs | not started |

Regenerate batches with `audit/ai-course/make_batches.js` (run from a scratch dir; it reads
`citation-ledger.json` and emits files pairing each atom with the claim and answer key it backs).

**Keep the controls — they demonstrably worked**, catching every planted canary and independently
corroborating the two worst findings:
- Subagents are **read-only reporters**; the orchestrator applies all edits. Max 3 concurrent.
- Seed each batch with 1–2 known-bad citations from the README without telling the reviewer. A `VERIFIED` on a
  canary means **discard the whole batch** and rerun with a different agent.
- Every `VERIFIED` needs a URL fetched that session **plus a quoted span**. Recall-based verdicts are
  `UNVERIFIED-FROM-MEMORY`, never `VERIFIED`.
- Row-count contract: N atoms in, N rows out. "The rest look fine" is a rejected response.
- Independently re-verify ~10% of `VERIFIED` rows yourself.

Two known-bad Tier-2/4 items to expect: **`MIT ATLAS` ×3** (should be **MITRE** ATLAS — the file already uses
the correct spelling once, so this is an error, not a convention) and **`OCC SR 11-7` ×6** (SR 11-7 is a
**Federal Reserve** letter; the OCC counterpart is **Bulletin 2011-12** — one site even reads
`OCC SR 11-7/FRB SR 11-7`, making the confusion visible).

Also watch for the systematic patterns already identified, since they recur: proposal-era 2021 text instead of
final Regulation (EU) 2024/1689; **course-authored governance presented as law** (ethics gates, RACI tables,
board-approval tiers cited to articles prescribing none of it — the largest cluster); wrong issuing body; and
fabricated sources.

---

## Task 7 — Fix the audit-note format

The `**Was:**` fields in `module-*.md` are prose paraphrases ("Answer key and explanation asserted that…")
rather than verbatim quotes of the original string. That defeats two purposes: the notes aren't readable without
a diff, and applied-vs-unapplied can't be checked mechanically.

Convert `Was:` to the **exact original string**, in backticks. Keep `Problem:` for the prose explanation. This is
what makes a future validation pass cheap — a script can then test whether each `Was:` string still exists in the
data file.

---

## Verification — all of these must pass before reporting done

```
dotnet build src/QuantumReadyDocs.csproj
dotnet test tests/QuantumReadyDocs.Tests/QuantumReadyDocs.Tests.csproj
```
- Baseline is **88 passed / 2 skipped, 0 failed** (the 2 skips are pre-existing PDF visual-dump tests). Expect
  88 + whatever you add. One pre-existing warning at `ExamService.cs:328` is acceptable.
- Encoding: `em ≈ 722`, `en ≈ 35`, `FFFD 0`, **`" ? " → 0`**, file parses via `new Function(...)`.
- Structure: `node -e` evaluation succeeds (catches trailing commas).
- **Array integrity** — `num` sequences still `1–9` and `10,11,12,14,15…27`, gap at 13 intact. Diff
  `mastery[i].num` and `.title` element-by-element against `43f2932` to prove zero insertions, deletions, or
  reorders.
- No `{` before `const COURSE_DATA`.
- Smoke test: run the app and load one corrected module (M16) plus one untouched module (M6) in Reading and
  Slides view; confirm dashes render correctly and no `?` artifacts remain. Take M16's quiz in Practice **and**
  Exam mode and confirm a passing attempt still issues a certificate — answer-key edits change what "correct"
  means, so confirm the server-side `ExamService.SubmitAttemptAsync` path grades against the corrected key.

**Do not publish or link the course while Task 2 or Task 6 is outstanding.** `training.html` exists in the
`365architect` repo and is deliberately **not** in `js/templates.js` nav — leave it that way until pricing is
confirmed and the content is sound.

## Suggested order

1. **Task 1** (encoding) — alone, own commit. Everything else edits this file.
2. **Task 2** (unapplied corrections) — the actual liability.
3. **Task 5** (README) — cheap, stops the docs lying.
4. **Task 3** and **Task 4** — independent cleanups.
5. **Task 7** — before Task 6, so new notes use the right format.
6. **Task 6** — the long tail.
