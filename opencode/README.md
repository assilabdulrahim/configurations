# opencode config — cost-aware routing

A router that picks **which model** runs each request, not just which
specialist, and re-routes when the context outgrows the window or a provider
runs out of credit.

```
opencode.jsonc          config: providers, commands, compaction, permissions
AGENTS.md               rules every agent inherits: accuracy, coding standards, signals
agents/  (23)           one file per agent; each is pinned to exactly one model
skills/  (5)            reusable workflows with bundled reference material
scripts/ (3)            what makes routing measured rather than guessed
```

---

## The one constraint everything follows from

**opencode has no runtime model swap.** `AgentConfig.model` is a static
string, and the `chat.params` plugin hook receives `model` as *input* but its
output only exposes `temperature/topP/topK/maxOutputTokens/options`. No
config field and no plugin can change a model mid-turn.

So **choosing an agent is choosing a model**. Every adaptation the router
makes — to a context that grew, to a provider that died — is a re-delegation
to a different agent. That is why there are 23 of them.

`subagent_depth: 1` keeps specialists from re-delegating, so every hop
returns through the one component that holds the session.

---

## Cost levels

| Level | Providers | Cost | Scarce resource |
|---|---|---|---|
| **L0 local** | `ollama` (LAN box) | free, unlimited, **private** | context (32k–256k) |
| **L1 free** | `openrouter/*:free`, `opencode` (Zen) | free | rate limits |
| **L2 subscription** | `kimi-for-coding` | flat | quota |
| **L3 metered** | `deepseek`, `google` | per token | account balance |

> Default to L1. Use L0 only for privacy or trivia. Climb to L2/L3 when L1
> stalls or the stakes are high.

L1 free models carry 200k–1M context — they beat the local box on capability
and (except `gemma4`) on window too, at the same price. **L0 wins on exactly
one axis: the code never leaves the LAN.**

---

## Scripts — measured, not guessed

| Script | Answers |
|---|---|
| `preflight.cjs` | Which providers are authed, is Ollama up, how much credit is left, which agents are **usable** |
| `ctx-estimate.cjs` | How many tokens a file set is, and which tiers hold it (`FITS` / `TIGHT` / `TOO BIG`) |
| `verify-config.cjs` | Static correctness — run after any edit to config or agents |

The router calls the first two at runtime. See [scripts/README.md](scripts/README.md),
which documents each script's **honest limits** — they matter more than the
features.

---

## Two adaptation mechanisms

### Context grew

Agents emit `CONTEXT_OVERFLOW` (see `AGENTS.md` → Signals). The router
re-measures with `ctx-estimate.cjs` and **jumps** to the smallest tier
reporting `FITS` — never `TIGHT`, which leaves no room for the reply or the
files the agent discovers it also needs.

When nothing fits: `free-analyst` (1M, free, read-only) reads the bulk and
produces a findings brief, and *that brief* — not the raw files — goes to the
implementer.

### Provider ran out

Only **DeepSeek** publishes a readable balance. Subscriptions and free tiers
expose no pre-flight quota at all; you learn you are out when a call returns
402 or 429. So the router keys off the error code and walks a fallback chain
where **every step is a different provider**:

```
implement   free-coder ──▶ coder ──▶ pickle-coder ──▶ local-coder
            (openrouter)   (kimi)    (zen)            (ollama)
validate    free-validator ──▶ reviewer ──▶ validator ──▶ local-validator
            (openrouter)       (deepseek)   (google)      (ollama)
```

Every switch is announced. Dead providers are recorded in the ledger so they
are not retried all session.

**Guard:** falling back on credit can *narrow* the window, so the router
re-checks context before landing in L0 — a credit fallback that silently
truncates has traded a billing problem for a correctness problem.

---

## Cross-model validation

Every change to code or infrastructure is checked by a model from a
**different family** — a model cannot see its own blind spots.
`verify-config.cjs` fails the build if any validator shares a family with any
implementer. It treats OpenRouter as a *broker*, so `openrouter/minimax/…`
and `openrouter/z-ai/…` count as genuinely different.

Validation at L1 costs nothing, so there is no excuse for skipping it.

---

## Skills

| Skill | Covers |
|---|---|
| `document` | Design docs, ADRs, RFCs, runbooks, READMEs, incident reports |
| `architecture` | Boundaries, decomposition, trade-offs, C4 diagrams |
| `cloud-architecture` | Topology, identity, DR, cost, IaC, well-architected review |
| `security-review` | STRIDE threat modelling, OWASP code review, dependency risk |
| `changelog` | Release notes and semantic version bumps |

**A skill beats a bigger model** — the router never climbs a tier to solve
what a skill already covers.

### Out of scope

Competitive analysis, market research, board decks, business reports,
executive workflows, and anything wanted as a finished formatted artifact go
to **GenSpark**. The router declines and offers the technical piece it can
genuinely produce instead — often the diagram or cost model that goes *into*
the deck.

The line: `document` handles **technical** documents grounded in code you can
cite as `path:line`. GenSpark handles **business** deliverables where the
evidence is market data and the output is a formatted artifact.

---

## Setup

```bash
opencode auth login
```

Required: `deepseek`, `kimi-for-coding`, `openrouter`, `google`.
Optional: `opencode` (Zen) — unlocks `pickle-coder` (Big Pickle) and 29 other
free models. Until then `preflight.cjs` correctly marks that agent `DEAD`.

Then verify:

```bash
curl -s https://models.dev/api.json         -o /tmp/models.json
curl -s http://192.168.86.24:11434/api/tags -o /tmp/tags.json
node scripts/verify-config.cjs /tmp
node scripts/preflight.cjs
```

## Commands

| Command | Does |
|---|---|
| `/preflight` | Provider health, credit, which agents are usable |
| `/ctx <paths>` | Token count and which tiers hold it |
| `/doc`, `/design`, `/cloud`, `/threat-model` | Invoke the matching skill |
| `/free`, `/local` | Force a tier |
| `/validate` | Cross-model check of the current diff |

---

## Editing this

After changing any agent pin, tier table, or the router's chains, run
`verify-config.cjs`. It catches the two failures that originally broke this
config: an agent pinned to a model that was **never pulled**
(`qwen3-coder-next`), and one pinned to a model with **no tool-calling
capability** (`deepseek-coder-v2`), which cannot drive an agent at all. Both
surfaced as a hang rather than a clean error.
