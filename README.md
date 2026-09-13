# Configurations Repository — Master Guide & Architecture Reference

This repository is a central operational hub consolidating multiple distinct tooling stacks: local and remote AI agent architectures, autonomous development harnesses, Windows administrative automations, database containers, and project handoff prompts.

---

## Table of Contents

1. [System Architecture & File Clusters](#1-system-architecture--file-clusters)
2. [Independence & Dependency Matrix](#2-independence--dependency-matrix)
3. [Duplicates & Redundancies](#3-duplicates--redundancies)
4. [How to Use Each Tool (Quickstart & Commands)](#4-how-to-use-each-tool-quickstart--commands)
   - [Cluster 1: OpenCode Cost-Aware AI Routing System](#cluster-1-opencode-cost-aware-ai-routing-system)
   - [Cluster 2: Autonomous Claude Code Loop Harness](#cluster-2-autonomous-claude-code-loop-harness)
   - [Cluster 3: Remote AI Server (Linux GPU Host) Management](#cluster-3-remote-ai-server-linux-gpu-host-management)
   - [Cluster 4: Windows Network Share Auto-Mounting](#cluster-4-windows-network-share-auto-mounting)
   - [Cluster 5: Local Database Containers](#cluster-5-local-database-containers)
   - [Cluster 6: GraphRAG Knowledge Base Pipeline](#cluster-6-graphrag-knowledge-base-pipeline)
   - [Cluster 7: Project Prompts & Handoff Contexts](#cluster-7-project-prompts--handoff-contexts)
5. [Security & Sensitivity: What to Be Careful About](#5-security--sensitivity-what-to-be-careful-about)
   - [🔴 Critical: Hardcoded Credentials](#-critical-hardcoded-credentials)
   - [🟡 Medium: Internal Network Topology & Private Identifiers](#-medium-internal-network-topology--private-identifiers)
   - [⚠️ Operational Traps & Failure Modes](#️-operational-traps--failure-modes)
6. [Recommended Repository Hygiene & Cleanup](#6-recommended-repository-hygiene--cleanup)

---

## 1. System Architecture & File Clusters

The files in this repository fall into **seven distinct functional clusters**, some of which are deeply interconnected while others are entirely self-contained:

```
configurations/
│
├── 🧠 CLUSTER 1: OpenCode Multi-Tier AI Agent & Routing Framework
│   ├── opencode/                     # Router config, 26 agent profiles, skills, validation scripts
│   │   ├── opencode.jsonc            # Core engine configuration (providers, tiers, compaction)
│   │   ├── AGENTS.md                 # Universal operating rules and signals for all subagents
│   │   ├── agents/                   # 26 specialised agent profiles pinned to specific models
│   │   ├── scripts/                  # Preflight, token estimation, test harnesses, pre-commit gate
│   │   ├── skills/                   # Reusable workflow prompt packs
│   │   └── plugins/trace.js          # Execution tracing and metrics capture plugin
│   ├── .githooks/pre-commit          # Git hook enforcing offline verification before commits
│   └── .gitattributes                # Enforces LF line-endings for shell hooks
│
├── 🔄 CLUSTER 2: Autonomous Claude Code Loop Harness
│   ├── loop.ps1                      # Root PowerShell loop driver (synchronized with stdin piping fix)
│   ├── loop-harness-v0.1/            # Self-contained harness template & workflow suite (tracked natively)
│   │   ├── loop.ps1                  # PowerShell loop driver (includes stdin piping fix)
│   │   ├── run-loop.sh               # Bash loop driver for Linux/macOS/WSL
│   │   ├── setup.ps1                 # Windows environment initializer
│   │   ├── PIPELINE.md, WINDOWS.md   # Harness architecture & Windows-specific operational guide
│   │   ├── templates/                # OBJECTIVE.md and RUBRIC.md contract templates
│   │   └── .claude/                  # Planner, builder, evaluator agents, slash commands, and hooks
│   ├── templates/                    # Root duplicate of loop-harness templates
│   └── .loop-logs/                   # Execution logs, stopping flags, and cycle reports
│
├── 🖥️ CLUSTER 3: Remote AI Server (Linux GPU Host) Management
│   ├── monitor.bat                   # Windows Terminal multi-pane remote dashboard launcher
│   ├── watch-mem.sh                  # Host memory monitoring script (runs on the Linux server)
│   └── windows-ssh.md                # SSH key deployment and permission setup cheatsheet
│
├── 📂 CLUSTER 4: Windows Network Share Auto-Mounting
│   ├── Mount-SambaShares.ps1         # Robust SMB drive mapper with stale connection purging
│   └── deploy-Scheduled-task-to-map-network.ps1 # Registers Windows Scheduled Task at user logon
│
├── 🐳 CLUSTER 5: Local Database Containers
│   ├── docker-compose.yml            # PostgreSQL & Azure SQL Edge development database services
│   ├── .env                          # Local secrets (git-ignored)
│   └── .env.example                  # Sanitized environment template for credentials
│
├── 🕸️ CLUSTER 6: GraphRAG Knowledge Base Pipeline
│   └── settings.yaml                 # Microsoft GraphRAG indexing and extraction configuration
│
└── 📝 CLUSTER 7: External Project Prompts & Handoffs
    ├── prompts/                      # Context and prompt batches for QuantumReadyDocs / 365architect
    └── coworker/                     # Workspace directory for agent collaboration sessions
```

---

## 2. Independence & Dependency Matrix

| File / Component | Status | Dependencies | Dependents | Can Be Safely Moved/Isolated? |
|---|---|---|---|---|
| **`opencode/`** | **Internal ecosystem** | Node.js (for scripts), network access or local Ollama host | `.githooks/pre-commit` | ❌ Yes, but must update git hook path if moved. |
| **`.githooks/pre-commit`** | **Dependent** | Requires `node` and `opencode/scripts/gate.cjs` | Invoked automatically by `git commit` | ❌ No, breaking this breaks normal commits unless `--no-verify` is used. |
| **`.gitattributes`** | **Independent** | Git | `.githooks/*` | ⚠️ Keep at root to prevent CRLF line-ending corruption on shell scripts. |
| **`loop-harness-v0.1/`** | **Self-Contained Template** | `claude` CLI, PowerShell 7 / Bash, Git | None | ✅ Tracked natively as standard files (no nested `.git`). Safe to copy into new projects. |
| **`loop.ps1` (root)** | **Synchronized** | `claude` CLI, `~/.claude` or `-HarnessRoot` | Writes to `.loop-logs/` | ✅ Upgraded to match `loop-harness-v0.1/loop.ps1` (with stdin piping). |
| **`templates/` (root)** | **Independent** | None | Read by loop harness when starting new runs | ⚠️ Duplicate of `loop-harness-v0.1/templates/`. |
| **`monitor.bat`** | **Partially Dependent** | Windows Terminal (`wt`), SSH client, remote host `192.168.86.24` | Requires `watch-mem.sh` to exist on the remote host | ✅ Independent locally; relies on LAN connectivity to Linux server. |
| **`watch-mem.sh`** | **Independent locally** | Linux environment (`awk`, `/proc/meminfo`) | Executed by `monitor.bat` via SSH | ✅ Target is the remote server `/home/assilabdulrahim/`. |
| **`windows-ssh.md`** | **Independent** | Documentation only | None | ✅ Informational only. |
| **`Mount-SambaShares.ps1`** | **Independent script** | Windows SMB client, network access to `\\gn100-3692` | Target of `deploy-Scheduled-task-to-map-network.ps1` | ⚠️ Can be moved, but Scheduled Task script will break if moved without updating path. |
| **`deploy-Scheduled-task...ps1`** | **Tightly Bound** | Windows Task Scheduler, requires `Mount-SambaShares.ps1` at exact hardcoded path | None | ❌ Hardcodes `C:\Users\AssilAbdulrahim\source\repos\configurations\Mount-SambaShares.ps1`. |
| **`docker-compose.yml`** | **Fully Independent** | Docker Engine / Docker Desktop, `.env` file | Local app stacks | ✅ Completely standalone (reads credentials from `.env`). |
| **`settings.yaml`** | **Independent pipeline** | GraphRAG CLI, local Ollama at `localhost:11434` | Expects prompt files in `prompts/` | ⚠️ Expects `prompts/extract_graph.txt`, etc., which are currently absent. |
| **`prompts/`** | **Independent** | Reference material for `QuantumReadyDocs` | None in this repository | ✅ Independent handoff documentation (kept for reference). |
| **`coworker/`** | **Independent** | None (currently empty) | None | ✅ Safe to use or remove. |

---

## 3. Duplicates & Redundancies (Resolved)

1. **`map_samba_shares.ps1`**:
   - **Resolved**: Removed from the repository. `Mount-SambaShares.ps1` serves as the single source of truth referenced by the scheduled task deployer.

2. **Root `loop.ps1` vs `loop-harness-v0.1/loop.ps1`**:
   - **Resolved**: Root `loop.ps1` has been updated with the fix from `loop-harness-v0.1/loop.ps1` to pipe prompts via stdin directly into `& claude -p`, preventing PowerShell argument escaping issues.

3. **Root `templates/` vs `loop-harness-v0.1/templates/`**:
   - Both directories contain identical copies of `OBJECTIVE.md` and `RUBRIC.md`.
   - Keep whichever location matches where you execute your loops.

---

## 4. How to Use Each Tool (Quickstart & Commands)

### Cluster 1: OpenCode Cost-Aware AI Routing System
A router designed for OpenCode that assigns requests across four cost tiers:
- **L0 Local (Ollama on LAN)**: Free, unlimited, private (Qwen, Gemma, Llama).
- **L1 Free (OpenCode Zen)**: Free, high context (200k–1M), tool-capable (`big-pickle`, `nemotron`).
- **L2 Subscription (Kimi / Moonshot)**: Primary coding model (quota-limited).
- **L3 Metered (DeepSeek, Google, OpenRouter, Anthropic)**: Architecture, security, and fallback validation.

#### Essential Commands
Run from the `opencode/` directory or root:

```bash
# 1. Check provider health, balances, and usable models:
node opencode/scripts/preflight.cjs

# 2. Estimate token count and tier suitability for a target codebase:
node opencode/scripts/ctx-estimate.cjs path/to/project

# 3. Validate configuration syntax and agent model bindings:
node opencode/scripts/verify-config.cjs

# 4. Run real smoke test calls against every configured provider:
node opencode/scripts/smoke-agents.cjs

# 5. Check if local repo configuration matches active OpenCode runtime:
node opencode/scripts/sync-check.cjs

# 6. Analyze cost and token usage traces:
node opencode/scripts/trace-report.cjs
```

#### Git Pre-Commit Gate
When `.githooks` is activated via `git config core.hooksPath .githooks`, any `git commit` executes `gate.cjs`. If the external model catalogs (`models.json` / `tags.json`) are missing or older than 24 hours, the gate gracefully skips network calls to stay offline-safe.

---

### Cluster 2: Autonomous Claude Code Loop Harness
Implements an autonomous development feedback loop:
`OBJECTIVE.md` (Human) ➔ `CHALLENGE.md` (Planner) ➔ `BUILD_PLAN.md` (Human review) ➔ `run-loop` (Builder + Evaluator cycles).

#### Running the Loop (Windows PowerShell 7)
```powershell
# From the project directory you wish to automate:
# 1. Initialize or copy the objective template
Copy-Item C:\Users\AssilAbdulrahim\source\repos\configurations\templates\OBJECTIVE.md .\OBJECTIVE.md
notepad .\OBJECTIVE.md

# 2. Run the loop driver with a maximum budget ceiling (e.g. 10 cycles):
pwsh C:\Users\AssilAbdulrahim\source\repos\configurations\loop-harness-v0.1\loop.ps1 -MaxCycles 10

# Emergency Stop:
# Touch or create an AGENT_STOP file in the working directory:
New-Item -ItemType File AGENT_STOP
```

---

### Cluster 3: Remote AI Server (Linux GPU Host) Management
Manages the dedicated LAN AI machine hosting Ollama (`192.168.86.24`).

1. **Deploying SSH Keys**:
   Follow instructions in `windows-ssh.md`:
   ```bash
   cat ~/.ssh/id_ed25519.pub | ssh assilabdulrahim@192.168.86.24 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
   ```

2. **Deploying the Memory Watcher**:
   Copy `watch-mem.sh` to the remote user home:
   ```bash
   scp watch-mem.sh assilabdulrahim@192.168.86.24:/home/assilabdulrahim/
   ssh assilabdulrahim@192.168.86.24 "chmod +x /home/assilabdulrahim/watch-mem.sh"
   ```

3. **Launching the Visual Dashboard**:
   Run `monitor.bat` from Windows (Command Prompt or Run dialog):
   - Opens Windows Terminal with 5 split panes: Interactive SSH session, Secondary terminal, `nvtop` (GPU telemetry), `watch-mem.sh` (RAM usage), and `journalctl -p 3 -f` (live system priority error stream).

---

### Cluster 4: Windows Network Share Auto-Mounting
Maintains stable persistent drive mappings to internal server `gn100-3692`:
- `K:` ➔ `\\gn100-3692\KnowledgeBase`
- `F:` ➔ `\\gn100-3692\FileShare`

#### Usage
- **Manual Mount / Test**:
  ```powershell
  pwsh .\Mount-SambaShares.ps1
  ```
  The script intelligently checks if the drives are responsive; if a drive is mapped but hung, it destroys stale handles (`Remove-SmbMapping` + `net use /delete`) before mounting anew.
- **Deploy Automatic Logon Task**:
  Run PowerShell as Administrator or user:
  ```powershell
  powershell.exe -ExecutionPolicy Bypass -File .\deploy-Scheduled-task-to-map-network.ps1
  ```
  Registers `AutoMapSambaShares` in Windows Task Scheduler to run silently whenever user `AssilAbdulrahim` logs in.

---

### Cluster 5: Local Database Containers
Spins up development databases bound to localhost:
- **PostgreSQL**: `127.0.0.1:5432` (volume: `postgres_data`)
- **Azure SQL Edge / MSSQL**: `127.0.0.1:1433` (volume: `mssql_system_data`)

#### Commands
```bash
# Start containers in background
docker compose up -d

# Check status
docker compose ps

# View container logs
docker compose logs -f

# Stop containers without deleting data
docker compose down
```

---

### Cluster 6: GraphRAG Knowledge Base Pipeline
`settings.yaml` configures Microsoft GraphRAG to index local files (`.cs`, `.ts`, `.js`, `.md`) using Ollama models:
- Entity extraction: `qwen3-coder-next:latest` (via `http://localhost:11434/v1`)
- Answers: `gemma4:26b`
- Embeddings: `qwen3-embedding:8b`
- Vector Store: LanceDB at `output/lancedb`

#### Usage
Ensure Ollama is running locally and execute:
```bash
graphrag index --root . --config settings.yaml
```
*(Note: requires downloading or providing the prompt template text files referenced in `settings.yaml`).*

---

### Cluster 7: Project Prompts & Handoff Contexts
Files inside `prompts/` are self-contained task definitions and context briefs for external codebases:
- `course-portal-next-steps.md`: Step-by-step citation validation and student access verification tasks for `QuantumReadyDocs`.
- `course-portal-remediation.md`: Critical defect fixes for `course_data.js` (including strict instructions regarding UTF-8 encoding without BOM, array indexing constraints, and regex/JSON parsing quirks).
- `give-me-the-context-eventual-minsky.md`: Comprehensive system orientation document for onboarding new AI agents to `QuantumReadyDocs`.

---

## 5. Security & Sensitivity: What to Be Careful About

### 🔴 Critical: Hardcoded Credentials (Sanitized)

| File | Parameter | Status & Remediation |
|---|---|---|
| **`docker-compose.yml`** | `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}` | ✅ **Sanitized**: Moved to local `.env` file (git-ignored) and templated via `.env.example`. |
| **`docker-compose.yml`** | `MSSQL_SA_PASSWORD: ${MSSQL_SA_PASSWORD}` | ✅ **Sanitized**: Sourced dynamically from `.env`. No plaintext passwords in Git history moving forward. |

---

### 🟡 Medium: Internal Network Topology & Private Identifiers

The following internal infrastructure details are committed in this repository:
1. **Internal IP Address**: `192.168.86.24` (present in `monitor.bat`, `windows-ssh.md`, and `opencode/opencode.jsonc`).
   - Identifies your private home/lab subnet structure and the exact IP of your AI workstation.
2. **Internal Server Names & Shares**:
   - Host `gn100-3692` with SMB network shares `\\gn100-3692\KnowledgeBase` and `\\gn100-3692\FileShare` in `Mount-SambaShares.ps1`.
3. **Local Usernames & Absolute Paths**:
   - Username `assilabdulrahim` / `AssilAbdulrahim` appears in `deploy-Scheduled-task-to-map-network.ps1`, `monitor.bat`, `windows-ssh.md`, and `prompts/*.md`.
4. **Proprietary Project Disclosures**:
   - `prompts/*.md` details internal production architectures, defect rates, security remediation plans, and uncommitted branches for `QuantumReadyDocs` and `365architect.com`.

> [!WARNING]
> **If pushing this repository to a public Git hosting platform (GitHub / GitLab public repos):**
> Scrub all passwords, internal IP addresses, server names, and proprietary project handoffs. Keep this repository **strictly private**.

---

### ⚠️ Operational Traps & Failure Modes

1. **Rigid Absolute Path in Scheduled Task**:
   `deploy-Scheduled-task-to-map-network.ps1` line 2 points to:
   `C:\Users\AssilAbdulrahim\source\repos\configurations\Mount-SambaShares.ps1`.
   If you rename or relocate this repository folder, the Scheduled Task will silently fail on every Windows logon.
2. **Missing Prompt Templates in GraphRAG (`settings.yaml`)**:
   `settings.yaml` expects `prompts/extract_graph.txt`, `prompts/summarize_descriptions.txt`, `prompts/community_report_graph.txt`, and `prompts/community_report_text.txt`. Currently, `prompts/` only contains Markdown project handoffs. Running GraphRAG will error until those files are populated.
3. **Loop Harness `-Unattended` Flag**:
   In `loop.ps1`, running with `-Unattended` bypasses the human checkpoint after the challenge phase. Running an unattended model loop against live code can consume massive token budgets or commit unintended destructive changes if stopping conditions are not strictly met.
4. **Git Pre-Commit Hook Requirement**:
   `.githooks/pre-commit` calls `node opencode/scripts/gate.cjs`. If Node.js is not on your PATH or if files within `opencode/` are moved, all standard `git commit` commands in this repo will be blocked. Use `git commit --no-verify` to bypass in emergencies.
5. **Port Binding Clashes**:
   `docker-compose.yml` maps host ports `5432` and `1433`. If you have local installations of PostgreSQL or SQL Server running on Windows bare metal, container startup will fail with port allocation errors (`bind: address already in use`).

---

## 6. Recommended Repository Hygiene & Cleanup

Completed cleanup operations performed:

- [x] **Delete Redundant File**: Removed `map_samba_shares.ps1` (`Mount-SambaShares.ps1` is the single source of truth).
- [x] **Synchronize Loop Driver**: Upgraded root `loop.ps1` with the bug fix from `loop-harness-v0.1/loop.ps1` (pipes prompts via stdin to avoid PowerShell character re-escaping).
- [x] **Sanitize Docker Passwords**: Extracted passwords from `docker-compose.yml` into `.env` (ignored by Git) and created `.env.example` as a template.
- [x] **Configure Git Hooks**: Activated the pre-commit hook via `git config core.hooksPath .githooks`.
- [x] **Isolate Project Prompts**: Kept in `prompts/` as historical reference documents for `QuantumReadyDocs`.
- [x] **Un-nest Sub-Repository**: Removed the embedded `.git` in `loop-harness-v0.1/` and converted all 29 files into directly tracked repository files, eliminating submodule sync issues and preventing corrupted nested repo copies.
- [x] **Merge Feature Branches & Prune Worktrees**: Merged `claude/troubleshooting-0a0d68` (restoring Kimi-for-coding flat-tier pins), unlinked the `deepseek-v4-flash-migration-abb605` worktree, and deleted the merged local branches cleanly.
