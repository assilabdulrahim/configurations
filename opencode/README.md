# opencode config — cost-aware routing

A router that picks **which model** runs each request, not just which
specialist, and re-routes when the context outgrows the window or a provider
runs out of credit.

```
opencode.jsonc          config: providers, commands, compaction, permissions
AGENTS.md               rules every agent inherits: accuracy, coding standards, signals
agents/  (26)           one file per agent; each is pinned to exactly one model
skills/  (5)            reusable workflows with bundled reference material
scripts/ (5)            what makes routing measured rather than guessed
```

---

## The one constraint everything follows from

**opencode has no runtime model swap.** `AgentConfig.model` is a static
string, and the `chat.params` plugin hook receives `model` as *input* but its
output only exposes `temperature/topP/topK/maxOutputTokens/options`. No
config field and no plugin can change a model mid-turn.

So **choosing an agent is choosing a model**. Every adaptation the router
makes — to a context that grew, to a provider that died — is a re-delegation
to a different agent. That is why there are 26 of them.

`subagent_depth: 1` keeps specialists from re-delegating, so every hop
returns through the one component that holds the session.

---

## Cost levels

| Level | Providers | Cost | Scarce resource |
|---|---|---|---|
| **L0 local** | `ollama` (LAN box) | free, unlimited, **private** | context (32k–256k) |
| **L1 free** | `opencode` (Zen) | free | rate limits, single provider |
| **L2 subscription** | `kimi-for-coding` | flat | quota |
| **L3 metered** | `deepseek`, `google`, `openrouter`, `anthropic` | per token | account balance |

> **Quality first. Default to L2 (Kimi). Use L3 for analysis and validation.
> Drop to L1 when L2/L3 quota or credit runs out. Use L0 for privacy,
> compression and trivia.**

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
| `smoke-agents.cjs` | Calls every model for real and checks the router's design invariants |
| `sync-check.cjs` | Whether the repo you edit still matches the config opencode actually loads |

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
implement   coder ──▶ free-coder ──▶ glm-coder ──▶ local-coder
            (kimi)    (zen)          (openrouter)  (ollama)
validate    reviewer ──▶ validator ──▶ local-validator
            (deepseek)   (google)      (ollama)
```

(The full set — reason, analyse, document, inspect, compress — is in
`agents/orchestrator.md` §5.)

Every switch is announced. Dead providers are recorded in the ledger so they
are not retried all session.

**The router's own credit.** It runs on metered DeepSeek, so zero stops
everything. `preflight.cjs` warns at $10, again at $2, and exits 2 - with
the reload URL and a flat-cost standby command. The router surfaces that
notice before anything else in the turn.

**Guard:** falling back on credit can *narrow* the window, so the router
re-checks context before landing in L0 — a credit fallback that silently
truncates has traded a billing problem for a correctness problem.

---

## Cross-model validation

Every change to code or infrastructure is checked by a model from a
**different family** — a model cannot see its own blind spots. The families
in use are `local:<model>`, `pickle`, `nemotron`, `muse`, `ling`, `kimi`,
`deepseek`, `google` and `z-ai` (GLM) (orchestrator.md §8); `verify-config.cjs` fails the
build if any validator shares a family with any implementer, and
`smoke-agents.cjs` shares the same family mapping via
`scripts/lib/families.cjs`.

Validation is a metered call by default, and that is the point — the cheapest
possible check on an irreversible change is a false economy. Drop to the free
tier when quota forces it, not to save a few cents.

---

## The brief is the thing worth buying

Subagents start from an empty context, so the §10 brief the router hands over is
the *entire* input to a paid hop — and a vague one is the expensive kind of wrong:
it produces work that looks fine, cannot be judged, and gets paid for twice under
the two-round bound.

`prompt-smith` (`anthropic/claude-sonnet-5`, L3) is the one agent dedicated to
writing that brief, and to authoring the `agents/` and `skills/` prompt files
themselves. It is **metered and reserved**, which is enforced two ways rather
than asked for politely:

- it appears in **no fallback chain**, so nothing failing can route to it — a
  chain step is somewhere you land when something broke, and an outage elsewhere
  must never start spending Anthropic tokens;
- `orchestrator.md` §7 names the **three conditions** under which the router may
  reach it at all. If none holds, the router writes the brief itself.

It costs one extra round trip, so condition 2 restricts it to hops already
measured in minutes. Sonnet 5 rather than Opus 5 because it is a structural
drop-in here — same 1M window, same API surface — at 2.5× less.

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

Required: `deepseek`, `kimi-for-coding`, `opencode` (Zen), `google`, `openrouter`.
Zen hosts the **entire L1 free tier**, so without it five agents are DEAD.
`openrouter` hosts `glm-coder`, the metered provider-outage escape hatch —
reachable when Zen is rate-limited or a paid provider runs out (orchestrator.md §5).

Optional: `anthropic`, a workspace API key (`sk-ant-api…`). It reaches exactly one
agent, `prompt-smith`. Without it that agent is DEAD and nothing else changes.

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
| `/prompt` | Write the brief for a hop, or author/audit an agent or skill prompt |
| `/validate` | Cross-model check of the current diff |

---

## Editing this

After changing any agent pin, tier table, or the router's chains, run
`verify-config.cjs`. It catches the two failures that originally broke this
config: an agent pinned to a model that was **never pulled**
(`qwen3-coder-next`), and one pinned to a model with **no tool-calling
capability** (`deepseek-coder-v2`), which cannot drive an agent at all. Both
surfaced as a hang rather than a clean error.
