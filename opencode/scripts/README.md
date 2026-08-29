# verify-config.cjs

Checks the opencode config against reality before you trust it. Run from the
`opencode/` directory.

    node scripts/verify-config.cjs <dir-containing-models.json-and-tags.json>

Fetch the two catalogs first:

    curl -s https://models.dev/api.json            -o /tmp/models.json
    curl -s http://192.168.86.24:11434/api/tags    -o /tmp/tags.json

What it catches:

- `opencode.jsonc` no longer parsing (string-aware, so `http://` is safe)
- an agent pinned to a model that is not pulled on the Ollama box, or that
  does not exist in models.dev — the original cause of the routing hang
- the router allow-listing an agent that does not exist, or an agent that
  exists but is unreachable from the router
- a `command` pointing at a missing agent
- **a validator sharing a model family with any implementer** — which would
  silently defeat cross-model validation
