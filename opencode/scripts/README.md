# Router support scripts

Four scripts. The first two are what the router calls at runtime so its
decisions are **measured rather than guessed**; the third is a static check
you run after editing config; the fourth calls every model for real and
checks the router's design against what actually answers.

---

## `preflight.cjs` — what can actually run right now

```bash
node scripts/preflight.cjs          # human-readable
node scripts/preflight.cjs --json   # machine-readable
```

Answers three things the router cannot reason its way to:

1. **Which providers are authenticated** — read from
   `~/.local/share/opencode/auth.json`. Prints provider ids and credential
   *types* only; never a credential value.
2. **Is the Ollama box up**, and which models are loaded.
3. **How much credit is left**, where an API exposes it.

Then it marks every agent `OK` or `DEAD`. The router must never route to a
`DEAD` agent. Exit code is 1 if anything is unreachable.

### The reload warning

The router itself runs on `deepseek/deepseek-v4-pro`, so DeepSeek hitting
zero stops **every** request, not just DeepSeek-tier ones. Preflight warns
early and loudly rather than at the moment it fails:

| State | Balance | Exit |
|---|---|---|
| `OK` | >= $10 | 0 (or 1 if an agent is unreachable) |
| `LOW` | < $10 | 2 |
| `CRITICAL` | < $2 | 2 |
| `EMPTY` | 0 | 2 |

Anything but `OK` prints a block with the reload URL and the flat-cost
standby command. Thresholds are env-overridable, which is how you exercise
the warning without draining an account:

```bash
DEEPSEEK_LOW_USD=999 node scripts/preflight.cjs      # forces the LOW path
DEEPSEEK_CRITICAL_USD=999 node scripts/preflight.cjs # forces CRITICAL
```

### Honest limits

Only **DeepSeek** publishes a balance endpoint that this can read
(`/user/balance`); Moonshot has one too if you authenticate that provider.

**Subscriptions (`kimi-for-coding`) and free tiers (`openrouter`, `opencode`)
expose no pre-flight quota at all.** There is no way to know you are out
until a call returns 402 or 429. That is precisely why
`agents/orchestrator.md` §5 defines fallback chains keyed on error code — a
pre-flight check alone cannot make the router credit-aware, and anything
claiming otherwise is guessing.

---

## `ctx-estimate.cjs` — will this actually fit

```bash
node scripts/ctx-estimate.cjs src/ lib/foo.ts
node scripts/ctx-estimate.cjs --diff     # uncommitted changes
node scripts/ctx-estimate.cjs --repo     # whole repo, minus build dirs
```

Measures a file set and prints, per tier, `FITS` (under 60% of the window),
`TIGHT` (60–100%) or `TOO BIG`, plus the largest contributing files.

The router routes to the **smallest tier reporting FITS**, and never to
`TIGHT` — that window has no room left for the reply, the tool output, or the
files the agent discovers it also needs.

### Honest limits

The count is `chars / 3.6 x 1.35 overhead`, a heuristic and **not** a
tokenizer. Expect ±20% on source, worse on minified or non-Latin text. The
60% threshold exists to absorb that error. It is deliberately pessimistic:
routing one tier too high costs nothing on the free tier, while
underestimating produces a truncated context and a confidently wrong answer.

Keep `TIERS` in this file in step with `agents/*.md` — `verify-config.cjs`
fails the build if they drift.

---

## `verify-config.cjs` — static correctness

```bash
curl -s https://models.dev/api.json         -o /tmp/models.json
curl -s http://192.168.86.24:11434/api/tags -o /tmp/tags.json
node scripts/verify-config.cjs /tmp
```

Runs from any directory — repo paths resolve relative to the script, not the
cwd. The argument is only the catalog directory.

Catches:

- `opencode.jsonc` no longer parsing — the stripper is string-aware, so the
  `//` in `http://` does not trip it
- an agent pinned to a model that is **not pulled** on the Ollama box or does
  not exist in models.dev. *This was the original cause of the routing hang:
  two agents pointed at `qwen3-coder-next`, which was never pulled*
- an agent pinned to a model with **no tool-calling capability**, which cannot
  drive an agent at all. *This was the second cause: `tester` sat on
  `deepseek-coder-v2`, whose capabilities are `["completion","insert"]`*
- the router allow-listing an agent that does not exist, or an agent that
  exists but is unreachable from the router
- a skill whose frontmatter `name` disagrees with its directory, or that the
  router routes to but which does not exist
- a `command` pointing at a missing agent
- **a validator sharing a model family with any implementer**, which would
  silently defeat cross-model validation. Family names follow
  `agents/orchestrator.md` §8 — `local:<model>`, `pickle`, `nemotron`, `muse`,
  `ling`, `kimi`, `deepseek`, `google` — and the mapping is shared with
  `smoke-agents.cjs` via `scripts/lib/families.cjs`
- **drift or missing coverage between `ctx-estimate.cjs`'s tier table and the
  real agent pins**, including a context window that disagrees with
  models.dev and any agent with no TIERS entry at all
- a fallback chain in the router naming an agent that does not exist

It also labels each model FREE / SUBSCRIPTION / metered, because models.dev
reports zero cost for subscription plans and that is easy to misread.

---

## `smoke-agents.cjs` — does the design hold at call time?

```bash
node scripts/smoke-agents.cjs           # free (Zen) + local tiers, costs nothing
node scripts/smoke-agents.cjs --paid    # + kimi / deepseek / google / zen
node scripts/smoke-agents.cjs --all     # alias of --paid
node scripts/smoke-agents.cjs --agent free-coder
node scripts/smoke-agents.cjs --json
```

`verify-config.cjs` checks the config against catalogs. `preflight.cjs` checks
that credentials resolve. **Neither calls a model.** This one does, because
every gap found so far lived in that space: a revoked key that still parses, a
model the catalog says has vision that returns 404 for images, an agent labelled
`tools` that never emits a tool call.

Per agent it measures three things the router assumes:

| Probe | Why it is not optional |
|---|---|
| `TEXT` | the model answers at all |
| `TOOLS` | it emits a real `tool_call` — an agent that cannot, cannot edit a file, so a text-only PASS is not enough. `tool_choice` is escalated `auto` → `required` before believing a failure, since tool use is probabilistic |
| `VISION` | it accepts an image, tested **both** inline base64 and remote URL, because only inline can carry a file off this machine |

Then it checks four invariants from `agents/orchestrator.md`:

1. every fallback chain has at least one live step
2. a live implementer and a live validator exist in **different** families —
   otherwise cross-model validation is impossible no matter what §8 says
3. the `default_agent` (the router itself) is live
4. something can read an inline image, or no chart or screenshot produced this
   session can ever be verified

### Honest limits

A `PASS` means the model answered one trivial prompt *now*. It is not a
capability benchmark, and free-tier daily caps mean a PASS at noon can be a 429
at midnight. Local models are called cold, so the first call to a 70B includes
load time — expect ~75 s, not a hang. Vision uses a solid 64x64 PNG on purpose:
a 1x1 pixel is rejected as `failed to decode` by several backends, which reads
exactly like "this model is blind" and is not.
