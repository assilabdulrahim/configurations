// Trace capture: what every model call actually cost, and how long it took.
//
// Writes one JSON line per completed assistant message, plus one per tool call,
// to ~/.config/opencode/traces/YYYY-MM-DD.jsonl.
//
// WHY A PLUGIN AND NOT AN INSTRUCTION. agents/orchestrator.md §4.5 records that
// session compression "never fired once across four validated hops" because it
// lived seven hundred lines from the procedure it belonged to. Anything that
// depends on an agent remembering to do it does not reliably happen. A plugin
// fires on the event bus or it does not exist at all - there is no third state
// where it quietly stops.
//
// METRICS ONLY - no prompt text, no response text, no tool arguments, no tool
// output. That is a hard guarantee, not a default: everything recorded below is
// a number, an id, or an enum. It means this file can never leak an API key that
// happened to be inside a file an agent read, and it costs nothing in value,
// because spend, latency, cache behaviour and error rates are all numeric.
// The one field deliberately dropped from ApiError is `responseBody`, which is
// the only part of an error that can echo request content back into the log.
//
// HONEST LIMITS:
//   - Appends are single sub-4KB writes. Concurrent opencode instances share
//     one file; in practice these interleave cleanly, but POSIX append atomicity
//     is not guaranteed on Windows. This is a log, not a ledger - a torn line is
//     a lost record, not corruption of anything that matters.
//   - `cost` is opencode's own figure, not the provider's invoice. Treat it as
//     an estimate until cross-checked against a real balance (see
//     scripts/trace-report.cjs).
//   - Nothing here captures Signals (ESCALATE / CONTEXT_OVERFLOW / BLOCKED).
//     Those are message text, which this deliberately does not record.

import fs from "fs"
import os from "os"
import path from "path"

const DIR = path.join(os.homedir(), ".config", "opencode", "traces")

// message.updated fires repeatedly while a response streams, and can fire again
// after completion. The `time.completed` guard alone still yields duplicates, so
// ids are tracked too. Both guards, not either - with only the first, a single
// turn produces hundreds of records and the store becomes unreadable.
const SEEN_CAP = 5000

export const TracePlugin = async ({ client }) => {
  const seen = new Set()
  let warned = false

  const warn = async (message, extra) => {
    // Report through opencode's own log rather than stderr: a plugin writing to
    // stdout corrupts the TUI. Once per session - a broken trace store is worth
    // saying, but not worth saying on every event.
    if (warned) return
    warned = true
    try {
      await client.app.log({
        body: { service: "trace", level: "warn", message, extra },
      })
    } catch {
      // logging the logging failure has nowhere left to go
    }
  }

  const once = (id) => {
    if (seen.has(id)) return false
    // Bounded so a long-running session cannot grow this without limit. Clearing
    // outright risks re-writing an old id; that is a duplicate line in a log,
    // which is cheaper than unbounded memory.
    if (seen.size > SEEN_CAP) seen.clear()
    seen.add(id)
    return true
  }

  const write = async (record) => {
    try {
      fs.mkdirSync(DIR, { recursive: true })
      const day = new Date().toISOString().slice(0, 10)
      fs.appendFileSync(path.join(DIR, day + ".jsonl"), JSON.stringify(record) + "\n")
    } catch (e) {
      await warn("trace store unwritable - tracing is off for this session", {
        dir: DIR,
        error: String((e && e.message) || e),
      })
    }
  }

  return {
    event: async ({ event }) => {
      // A trace store is never worth failing a session over. Anything unexpected
      // in a payload shape is swallowed here rather than propagating into the
      // event bus.
      try {
        if (event.type === "message.updated") {
          const m = event.properties && event.properties.info
          if (!m || m.role !== "assistant") return
          if (!m.time || !m.time.completed) return
          if (!once("m:" + m.id)) return

          const t = m.tokens || {}
          const cache = t.cache || {}
          await write({
            kind: "msg",
            ts: new Date().toISOString(),
            sessionID: m.sessionID,
            messageID: m.id,
            agent: m.mode,
            providerID: m.providerID,
            modelID: m.modelID,
            ms: m.time.completed - m.time.created,
            cost: m.cost,
            tokens: {
              input: t.input,
              output: t.output,
              reasoning: t.reasoning,
              cacheRead: cache.read,
              cacheWrite: cache.write,
            },
            finish: m.finish || null,
            // name/statusCode/isRetryable only. `responseBody` and `message` are
            // free text and can carry request content - see the header.
            error: m.error
              ? {
                  name: m.error.name,
                  statusCode: (m.error.data && m.error.data.statusCode) || null,
                  retryable: (m.error.data && m.error.data.isRetryable) || false,
                }
              : null,
          })
          return
        }

        if (event.type === "message.part.updated") {
          const p = event.properties && event.properties.part
          if (!p || p.type !== "tool") return
          const s = p.state
          if (!s || (s.status !== "completed" && s.status !== "error")) return
          if (!once("t:" + p.callID + ":" + s.status)) return

          await write({
            kind: "tool",
            ts: new Date().toISOString(),
            sessionID: p.sessionID,
            messageID: p.messageID,
            callID: p.callID,
            tool: p.tool,
            status: s.status,
            ms: s.time && s.time.end ? s.time.end - s.time.start : null,
            // `state.error` is a free string that can contain file contents, so
            // the status enum is all that is recorded. Error text arrives only
            // if text capture is ever turned on deliberately.
          })
        }
      } catch (e) {
        await warn("trace event handler failed", { error: String((e && e.message) || e) })
      }
    },
  }
}
