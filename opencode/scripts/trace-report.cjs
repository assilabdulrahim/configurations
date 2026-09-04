// What the traces say. Reads the JSONL that plugins/trace.js writes.
//
//   node scripts/trace-report.cjs
//   node scripts/trace-report.cjs --since 2026-09-01
//   node scripts/trace-report.cjs --json
//
// Deliberately four sections, not a dashboard. Each one answers a question this
// config could not previously answer at all:
//
//   spend    - cost per provider, INCLUDING the two that publish no balance API
//              (kimi-for-coding, google). preflight.cjs can only say "no balance
//              endpoint"; this says what was actually spent.
//   cache    - agents/orchestrator.md §4.5 asserts "there is no prompt cache in
//              this configuration" and reasons from it. If cacheRead is ever
//              non-zero, that reasoning is wrong and §4.5 needs correcting. This
//              is the check verify-config.cjs cannot make from static files.
//   latency  - §3 records validator at a measured 1453ms and everything else at
//              nothing. This fills the column in.
//   errors   - which providers actually 429, and whether it was retryable.
//
// HONEST LIMITS: `cost` is opencode's own computation, not a provider invoice -
// cross-check one provider against a real balance delta before trusting the
// column (see the README). Percentiles over a handful of calls are noise; the
// call count is printed next to them so you can see when that is the case.
// Nothing here reports Signals or brief quality - the traces are metrics-only.

const fs = require('fs');
const os = require('os');
const path = require('path');

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const SINCE = (argv.includes('--since') && argv[argv.indexOf('--since') + 1]) || null;
const DIR = path.join(os.homedir(), '.config', 'opencode', 'traces');

if (!fs.existsSync(DIR)) {
  console.log('No trace store at ' + DIR);
  console.log('Deploy plugins/trace.js to ~/.config/opencode/plugins/ and run a session.');
  process.exit(0);
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.jsonl'))
  .filter(f => !SINCE || f.slice(0, 10) >= SINCE).sort();

const rows = [];
let skipped = 0;
for (const f of files) {
  for (const line of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    // A torn line from a concurrent append is a lost record, not a reason to
    // die - count them so a systemic problem is visible rather than silent.
    try { rows.push(JSON.parse(line)); } catch { skipped++; }
  }
}

const msgs = rows.filter(r => r.kind === 'msg');
const tools = rows.filter(r => r.kind === 'tool');

if (!msgs.length) {
  console.log('Trace store has no completed assistant messages yet' +
    (skipped ? ' (' + skipped + ' unparseable lines)' : '') + '.');
  process.exit(0);
}

const by = (list, key) => list.reduce((acc, r) => {
  const k = r[key] || '(none)';
  (acc[k] = acc[k] || []).push(r);
  return acc;
}, {});
const sum = (list, f) => list.reduce((a, r) => a + (Number(f(r)) || 0), 0);
const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;
const pctl = (nums, p) => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

const out = { files: files.length, messages: msgs.length, tools: tools.length, skipped };

// ---- spend ------------------------------------------------------------
out.spend = Object.entries(by(msgs, 'providerID')).map(([provider, r]) => ({
  provider, calls: r.length, cost: sum(r, x => x.cost),
  input: sum(r, x => x.tokens && x.tokens.input),
  output: sum(r, x => x.tokens && x.tokens.output),
})).sort((a, b) => b.cost - a.cost);

// ---- cache ------------------------------------------------------------
out.cache = out.spend.map(s => {
  const r = msgs.filter(m => m.providerID === s.provider);
  const read = sum(r, x => x.tokens && x.tokens.cacheRead);
  const write = sum(r, x => x.tokens && x.tokens.cacheWrite);
  return { provider: s.provider, cacheRead: read, cacheWrite: write,
    input: s.input, hit: pct(read, read + s.input) };
});

// ---- latency ----------------------------------------------------------
out.latency = Object.entries(by(msgs, 'agent')).map(([agent, r]) => {
  const ms = r.map(x => Number(x.ms)).filter(n => Number.isFinite(n));
  return { agent, calls: r.length, p50: pctl(ms, 50), p95: pctl(ms, 95) };
}).sort((a, b) => b.p50 - a.p50);

// ---- errors -----------------------------------------------------------
out.errors = Object.entries(msgs.filter(m => m.error).reduce((acc, m) => {
  const k = (m.error.name || '?') + ' ' + (m.error.statusCode || '-') +
    (m.error.retryable ? ' (retryable)' : '');
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {})).sort((a, b) => b[1] - a[1]);

if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

console.log('traces: ' + files.length + ' file(s), ' + msgs.length + ' messages, ' +
  tools.length + ' tool calls' + (SINCE ? ', since ' + SINCE : '') +
  (skipped ? ', ' + skipped + ' UNPARSEABLE' : ''));

console.log('\n-- spend --');
console.log('   provider        calls        cost      input tok     output tok');
for (const s of out.spend)
  console.log('   ' + s.provider.padEnd(16) + String(s.calls).padStart(5) +
    ('$' + s.cost.toFixed(4)).padStart(12) + String(s.input).padStart(15) +
    String(s.output).padStart(15));
console.log('   ' + 'TOTAL'.padEnd(16) + String(msgs.length).padStart(5) +
  ('$' + sum(msgs, x => x.cost).toFixed(4)).padStart(12));

console.log('\n-- cache (is there a prompt cache? orchestrator.md §4.5 says no) --');
console.log('   provider          cacheRead      cacheWrite    input tok   hit%');
for (const c of out.cache)
  console.log('   ' + c.provider.padEnd(16) + String(c.cacheRead).padStart(12) +
    String(c.cacheWrite).padStart(16) + String(c.input).padStart(13) +
    String(c.hit + '%').padStart(7));
const anyCache = out.cache.some(c => c.cacheRead > 0);
console.log('   ' + (anyCache
  ? '=> cacheRead is NON-ZERO. §4.5 is wrong and should be corrected.'
  : '=> no cache reads observed. §4.5 holds, on this sample.'));

console.log('\n-- latency (ms) --');
console.log('   agent               calls       p50       p95');
for (const l of out.latency)
  console.log('   ' + l.agent.padEnd(18) + String(l.calls).padStart(6) +
    String(l.p50).padStart(10) + String(l.p95).padStart(10) +
    (l.calls < 5 ? '   (thin sample)' : ''));

console.log('\n-- errors --');
if (!out.errors.length) console.log('   none recorded');
else for (const [k, n] of out.errors) console.log('   ' + String(n).padStart(4) + '  ' + k);
