# QuantumReadyDocs — System Context

**Purpose of this document:** onboard a fresh agent with no prior session history. It states
what the system is, what works, what is half-built, and the non-obvious traps that have already
caused production outages. Verified against the repository on 2026-07-29.

---

## 1. What this is

`QuantumReadyDocs` serves **docs.365architect.com**. One ASP.NET Core app (net10.0, minimal APIs,
`WebApplication.CreateSlimBuilder`, top-level statements, published as a **Native AOT** container)
hosting four distinct products:

| Surface | Route | Nature |
|---|---|---|
| Documentation site | `/`, `/{**path}` | Markdown in `content/`, server-rendered |
| Course portals | `/courses/{id}/` | Static-file SPAs, entitlement-gated data |
| Admin dashboard | `/admin/students` | Student access management |
| 365-sites | `/sites/{risk\|zk\|pqc}` | Prebuilt React/Vite assessment tools |

Repo layout: `src/` (app), `tests/QuantumReadyDocs.Tests/` (xunit), `content/` (markdown),
`scripts/schema/` (SQL), `audit/ai-course/` (citation audit trail).

**Commands**

```bash
dotnet build src/QuantumReadyDocs.csproj
dotnet test tests/QuantumReadyDocs.Tests/QuantumReadyDocs.Tests.csproj   # 105 pass, 2 skipped
```

Run via `.claude/launch.json` configs, never a bare `dotnet run`:
`QuantumReadyDocs` (63031, normal) · `QuantumReadyDocs (anonymous)` (63041, B2C forced off +
LocalDB) · `QuantumReadyDocs (dead db)` (63061, unreachable DB, to test degraded mode).

---

## 2. Git state — read before touching anything

```
checied-in-by-mistake  5ff795b   <- ACTIVE, checked out, pushed to origin
master                 2e7d59d   ahead 2 of origin/master, NOT an ancestor of the active branch
origin/master          6d0618a
```

The two lines have **diverged**. `master` carries a commit adding three handoff `.md` files under
`docs/`; the active branch branched before it, deleted `docs/refactor-program-cs-prompt.md`, and
added 30 AI-security content files. `git log HEAD..master` = `2e7d59d` only.

A second worktree exists at `.claude/worktrees/ai-course-portal-fix-3c319c` on
`claude/db-degrade-on-master` (`d8f1a28`) — an ancestor of the active branch, safe to remove.

**Deployment is `.github/workflows/deploy.yml`, triggered on push to `master`**, building the
Native AOT container and deploying to Azure Web App `docs-365architect`
(RG `rg-corp-apps-eastus2`). Pushing master ships to production. The user has been explicit about
wanting to approve commits — **do not commit or push without asking.**

---

## 3. Access-control model (the core domain concept)

The course *shell* is public. The **data** is gated.

```
GET /courses/{id}/course_data.js
  ├─ ResolveCallerEmail(ctx)          cookie qr_dev_email → DevMode:SimulatedEmail → B2C claims
  ├─ email present  → StudentAccessService.HasActiveAccessAsync(email)   (DB is sole authority)
  └─ email absent   → devForceFullAccess                                 (anonymous only)
       ├─ true  → Results.File(...)         full build (~900 KB, 26 modules)
       └─ false → trimmed sample            courseInfo + specialist[0] + mastery:[]
                                            stamped accessMode:"preview" + totalModules (~43 KB)
```

`cert.StudentAccess` keys on **email only — there is no course column**, so one grant unlocks
every course. Grants carry `GrantedUtc`, `AccessDurationMonths`, `RevokedUtc`. Status is derived:
`revoked` > `expired` > `active`.

`HasActiveAccessAsync` **fails closed** — a DB error returns false. This is load-bearing: an
unreachable database withholds paid content rather than leaking it.

Real exams and certificates are separately gated by the `StudentAccess` policy on
`/api/exams/*`. Certificate download requires ownership, not an active grant.

---

## 4. Feature status

### Working and verified

- **Documentation site** — `ContentStore` walks `content/`, `FrontMatterParser` reads YAML,
  `HtmlRenderer` renders shell + sidebar + breadcrumbs + prev/next + command palette (`⌘K`).
  Hot-reloads in Development. Mermaid, KaTeX, Prism supported.
- **Entitlement gating** — verified end-to-end: grant → simulate → revoke → next request returns
  the 43 KB preview; reinstate → 900 KB full build. `/api/me` reports `hasCourseAccess` in step.
- **Admin dashboard** (`/admin/students`) — grant/revoke/reinstate/delete, live status badges,
  simulated-identity control for local testing. JS lives in `wwwroot/js/admin.js`.
- **Shared portal nav** (`wwwroot/js/portal-nav.js`) — one nav across all four surfaces, showing
  active identity + entitlement badge + sign-out. Admin link renders only when reachable.
- **Themed error pages** — 403/404/500 through `HtmlRenderer.RenderError`, correct status codes,
  correlation id on 500s, exception text never exposed. `/api/*` gets `application/problem+json`.
- **Degraded startup + `/health`** — see §5.
- **Exams** — server-side grading, per-module and course-wide (proportional sampling via
  `ExamSamplingService`), 24h cooldown, Syncfusion PDF certificates.

### Half-built — do not assume these work

- **Course split.** `src/wwwroot/courses/ai-governance/` and `ai-ethics-privacy/` exist but are
  **completely empty** (0 files; only empty `presentation_decks/`/`presentation_extended/`
  subdirectories, which git cannot track — hence a clean `git status`). Both routes 404. The `ai`
  course still holds all 26 modules. **The split has not started.**
- **AI security docs** — 30 files under `content/08-ai-security/` (standards / threats / defenses
  / governance / engagement) vs 60 for PQC. Structure is in place; **citations have not been
  audited** — see §6.

### Not started

- **Phase 5 go-to-market.** The marketing repo `365architect` has no `training.html` and no
  Training/Certification nav entry.
- **PQC course parity** — bug fixes only; no category tags, no curriculum expansion, no audit.
- **Accessibility** was never in the original 5-phase plan; treat as new scope.

---

## 5. The production outage — cause and current mitigation

**Symptom:** `docs.365architect.com/courses/ai/` returned an Azure App Service **503**, not an app
error page. A 503 means the process is not running, so no in-app handler can respond.

**Cause:** `DbInitializer` runs before `app.Run()` and issues `CREATE SCHEMA` / `CREATE TABLE`.
Locally the developer is effectively sysadmin on LocalDB, so the schema is created on first run
and the drift is invisible. **In production the app connects as read/write-only (`db_datareader` /
`db_datawriter`) and cannot execute DDL** — the exception terminated startup, and the platform
served 503 for every request, including documentation and the free preview, which need no
database at all.

**Mitigations now in place** (commit `d8f1a28`, present on the active branch):

- Startup DB failure is caught, logged Critical, and the app continues in **degraded mode**.
- `DbInitializer` treats permission errors as an expected configuration state; each step
  continues independently. (A prior catch logged "this shouldn't crash startup" then rethrew.)
- `DbInitializer.FindMissingObjectsAsync()` — **catalog reads only**, so it works under the
  production identity — names each missing object and the feature it blocks.
- `GET /health` (unauthenticated) → `{status, schemaInitialized, databaseReachable,
  missingObjects, detail}`. `status` ∈ `healthy` | `schema-incomplete` | `degraded`. `detail` is
  suppressed in Production (connection errors name server and login).
- `scripts/schema/001-schema.sql` — idempotent, create-only, for an **admin** to run once.
  Includes collation-conditional email normalisation and a verification query.

**Still required in production:** run `001-schema.sql` as a DDL-capable identity. Deploy order:
script first, then app. Reverse order now only means degraded operation, not an outage.

**Related latent risk (pre-existing, untouched):** base `src/appsettings.json` ships a LocalDB
connection string. Production escapes it only because `appsettings.Production.json` overrides it
to `""` (fail-fast, real value from Key Vault `QuantumReadyDb--ConnectionString`). If
`ASPNETCORE_ENVIRONMENT` is not exactly `Production`, the app silently looks for LocalDB. Worth
changing the base default to `""`.

---

## 6. Content quality warning

An audit (`audit/ai-course/`) of the 13 AI **course** modules (mastery `num` 15–27) found a
**75% Tier-1 regulatory citation defect rate** — 39 defects in the first 52 citations. **These
modules are not publishable**, and go-to-market must not ship pointing at them.

The defects are not typos. Five systematic authoring patterns: (1) proposal-era EU AI Act text
instead of final Regulation (EU) 2024/1689; (2) course-authored governance presented as law —
largest cluster; (3) wrong issuing body (A29WP as EDPB, DOJ as FTC, MITRE as MIT); (4) fabricated
sources; (5) overbroad legal claims.

**Signature failure mode: a real document cited for a claim it does not support.** Verifying a
source exists is insufficient — verify it against the proposition it backs. Patterns 1 and 2 are
*process* defects and will regenerate in any new authoring pass. The new
`content/08-ai-security/` pages were written after this audit and **have not themselves been
audited**.

---

## 7. Traps that have already cost real time

1. **Module identity is an array position.** Persisted in `cert.ExamAttempts.ModuleIndex` and
   re-resolved against live `course_data.js`. Certificates reference attempts. Inserting,
   deleting or reordering mid-array silently re-points every later historical record.
   Only ever **append**; mutate existing entries in place. `CourseDataStore.ValidateModuleOrder`
   requires `num` strictly increasing per track — gaps allowed, duplicates/decreases throw.
   The AI course has a **permanent gap at `num` 13**; preserve it.

2. **`wwwroot` is served from the build output.** `Program.cs` resolves the web root from
   `AppContext.BaseDirectory`, and the csproj copies `wwwroot/**` with `PreserveNewest`. Editing
   `src/wwwroot` does **not** change what a running server sends — restart. Front-end edits that
   "don't work" are almost always this, and it looks exactly like a browser cache bug.

3. **`CourseDataStore` brace scan.** Finds the JSON literal via `content.IndexOf('{')` across the
   whole file, so a `{` anywhere in a header comment breaks parsing. The exception is swallowed,
   `GetCourseData` returns null, and the course serves **nothing with no visible error**. Guarded
   by `CourseContentIntegrityTests`.

4. **`MeResponse` positional order** is `(Authenticated, Name, Email, InstructorAccess,
   HasCourseAccess)`. `InstructorAccess` must stay in position 4 — reordering compiles cleanly
   and silently grants course access to instructors and nobody else.

5. **Never sign into Azure B2C locally.** The dev B2C configuration points at the **real
   production tenant**. Use the simulated-identity flow instead: grant an email at
   `/admin/students`, set the simulated email there (cookie `qr_dev_email`), and
   `POST /account/dev-signout` to drop it.

6. **`DevMode:ForceFullAccess` / `ForceInstructorAccess` are `true` in the *base*
   `appsettings.json`**, not the Development file. They are inert while B2C is on (`!b2cEnabled`
   guard) and a loopback guard backstops the admin surface, but they belong in
   `appsettings.Development.json`. With `ForceFullAccess` on, signing out locally shows the full
   course under a "dev override" badge — not the real preview.

7. **Cache-control is a correctness concern here, not performance.** Entitlement-dependent
   responses (`course_data.js`, `/api/me`, `/api/admin/*`, `/admin/students`) must be
   `no-store` + `Vary: Cookie`. The original revocation bug was `ServeFile` stamping
   `public, max-age=3600` on the entitled build. Unversioned static assets use
   `public, no-cache` + `Last-Modified`; only `?v=`-fingerprinted URLs are `immutable`.

8. **`/api/*` must never receive an HTML error.** Cookie-auth redirects and all error handlers
   content-negotiate. A 302 to an HTML page is transparently followed by `fetch()`, the caller
   gets 200-with-HTML, `response.json()` throws, and the real cause is replaced by a parse error.

---

## 8. Known debt

- **`src/Program.cs` is ~1,475 lines** — 43 route registrations, 10 loose static helpers, the
  admin dashboard as an inline HTML string, all middleware wiring. Should be decomposed into
  `Endpoints/` + `Infrastructure/` static classes. A brief for this existed at
  `docs/refactor-program-cs-prompt.md`; it was deleted on the active branch but survives on
  `master` (`2e7d59d`).
- **`courses/ai/app.js` and `courses/pqc/app.js` are near-identical ~1,900-line copies.** Any
  course split should extract a shared `wwwroot/js/course-portal.js` rather than adding a third
  and fourth copy.
- **`CourseAccessIntegrationTests.cs`** is named for HTTP-level testing but makes no HTTP request;
  its final test is `Assert.True(true)`. It would not have caught the cache-header regression. A
  real `WebApplicationFactory` + test-auth-handler suite is still outstanding.
- Empty `ai-governance` / `ai-ethics-privacy` course directories should be removed or completed.

---

## 9. Suggested next steps

1. **Reconcile the branches.** Decide whether `master`'s `2e7d59d` (handoff docs) is wanted, then
   fast-forward or rebase so one line leads. Remember: pushing `master` deploys.
2. **Run `scripts/schema/001-schema.sql` in production** as a DDL-capable identity, then confirm
   `/health` returns `{"status":"healthy","missingObjects":[]}`.
3. **Audit the new `content/08-ai-security/` citations** against §6 before any go-to-market use.
4. **Decide the course split** — including the per-course entitlement question in §3, which has
   no answer today.
5. Optional: `Program.cs` decomposition, shared course-portal extraction, real HTTP integration
   tests.

---

## Verification

This document is descriptive; there is nothing to build. To confirm the state it describes:

```bash
git -C <repo> log --oneline -4 && git -C <repo> status --short
dotnet test tests/QuantumReadyDocs.Tests/QuantumReadyDocs.Tests.csproj
```

Then start the `QuantumReadyDocs` launch config and check:

All six below were run and confirmed on 2026-07-29.

| Check | Expected |
|---|---|
| `curl localhost:63031/health` | `{"status":"healthy","schemaInitialized":true,"databaseReachable":true,"missingObjects":[]}` |
| `curl -I localhost:63031/courses/ai/course_data.js` | `no-store, must-revalidate, no-cache, max-age=0, private` + `Vary: Cookie` |
| `curl -sI localhost:63031/courses/ai/course_data.js \| grep -i length` | **~903 KB, NOT the preview** — see note below |
| `curl -i localhost:63031/Account/AccessDenied` | 403 + `class="error-page"` |
| `curl localhost:63031/api/does-not-exist` | 404 `application/problem+json` |
| `curl -o /dev/null -w '%{http_code}' localhost:63031/courses/ai-governance/` | 404 — confirms the split is not done |

**Do not read the third row as a leak.** On the default `QuantumReadyDocs` config, B2C is off and
`DevMode:ForceFullAccess` is `true` in base `appsettings.json`, so an anonymous caller resolves to
no identity and correctly receives the **full** build via the dev override (trap 6). This is the
single most misleading thing about the local setup: it looks exactly like the paywall failing.

To exercise the real fail-closed path, use a config with `ForceFullAccess=false`. The
`QuantumReadyDocs (dead db)` config does that *and* points at an unreachable database — verified:

```
/                 200   30,080 bytes
/courses/ai/      200   11,664 bytes
course_data.js    200   43,229 bytes   accessMode":"preview"   <- fail-closed, correct
/health           200   {"status":"degraded","schemaInitialized":false,"databaseReachable":false}
```

That run is the important one: it proves the site stays up with no database *and* that an
unreachable database withholds paid content rather than leaking it. **If `course_data.js` returns
~900 KB under the dead-db config, the fail-closed entitlement path is broken and paid content is
leaking.**
