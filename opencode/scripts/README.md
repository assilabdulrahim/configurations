# Router support scripts

Three scripts. The first two are what the router calls at runtime so its
decisions are **measured rather than guessed**; the third is a static check
you run after editing config.

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
  silently defeat cross-model validation. It knows OpenRouter is a *broker*,
  so `openrouter/minimax/…` and `openrouter/z-ai/…` count as different
  families
- **drift between `ctx-estimate.cjs`'s tier table and the real agent pins**
- a fallback chain in the router naming an agent that does not exist

It also labels each model FREE / SUBSCRIPTION / metered, because models.dev
reports zero cost for subscription plans and that is easy to misread.
