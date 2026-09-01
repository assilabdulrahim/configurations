// Smoke test: does the router's design actually hold at call time?
//
//   node scripts/smoke-agents.cjs              # free + local tiers (costs nothing)
//   node scripts/smoke-agents.cjs --paid       # + kimi / deepseek / google / zen
//   node scripts/smoke-agents.cjs --agent free-coder
//   node scripts/smoke-agents.cjs --json
//
// verify-config.cjs checks the config against catalogs; preflight.cjs checks
// that credentials resolve. Neither one calls a model. This does - it sends a
// real completion to every agent's pinned model and then checks the router's
// design invariants against what actually answered.
//
// Per agent it measures three things, because the router assumes all three:
//   TEXT    the model answers at all
//   TOOLS   it emits a tool call when asked - an agent that cannot call tools
//           cannot edit a file, so a text-only PASS is not enough
//   VISION  it accepts an image, where models.dev claims image input
//
// Then it checks four invariants from agents/orchestrator.md:
//   1. every fallback chain has at least one live step
//   2. a live implementer and a live validator exist in DIFFERENT families,
//      or cross-model validation is impossible no matter what the doc says
//   3. the default_agent (the router itself) is live
//   4. at least one live agent can read an image, or no visual artifact this
//      session produces can ever be verified
//
// HONEST LIMITS: a 200 here means the model answered one trivial prompt now.
// It is not a capability benchmark, and free-tier daily caps mean a PASS at
// noon can be a 429 at midnight. Local models are called cold, so the first
// call to a large one includes load time and can take minutes.

const fs = require('fs');
const path = require('path');
const os = require('os');

if (typeof fetch !== 'function') {
  console.error('smoke-agents needs Node 18+ for global fetch (running ' + process.version + ').');
  process.exit(2);
}

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const PAID = argv.includes('--paid') || argv.includes('--all');
const ONLY = (argv.includes('--agent') && argv[argv.indexOf('--agent') + 1]) || null;
const OLLAMA = 'http://192.168.86.24:11434';
const AUTH = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
const ROOT = path.join(__dirname, '..');

const log = (...a) => { if (!JSON_OUT) console.log(...a); };

let auth = {};
try { auth = JSON.parse(fs.readFileSync(AUTH, 'utf8')); } catch { /* handled per provider */ }
const key = id => { const v = auth[id]; return v && (v.key || v.apiKey || v.access); };

// OpenRouter attributes requests by app. Some free models (inkling) refuse a
// bare API call with 403 "only available on agentic harnesses", so the smoke
// test must identify itself the same way opencode does or it reports a false
// failure.
const OR_ATTRIB = { 'HTTP-Referer': 'https://opencode.ai', 'X-Title': 'opencode' };

// provider -> how to reach an OpenAI-shaped /chat/completions for it
const ENDPOINT = {
  ollama: () => [OLLAMA + '/v1/chat/completions', {}],
  openrouter: k => ['https://openrouter.ai/api/v1/chat/completions',
    { Authorization: 'Bearer ' + k, ...OR_ATTRIB }],
  deepseek: k => ['https://api.deepseek.com/chat/completions', { Authorization: 'Bearer ' + k }],
  'kimi-for-coding': k => ['https://api.kimi.com/coding/v1/chat/completions', { Authorization: 'Bearer ' + k }],
  google: k => ['https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    { Authorization: 'Bearer ' + k }],
  opencode: k => ['https://opencode.ai/zen/v1/chat/completions', { Authorization: 'Bearer ' + k }],
  // models.dev lists minimax's base as .../anthropic/v1, but it also serves an
  // OpenAI-shaped /v1/chat/completions - verified 200 with a choices[] body.
  minimax: k => ['https://api.minimax.io/v1/chat/completions', { Authorization: 'Bearer ' + k }],
};

// Tier is per-MODEL, not per-provider: opencode (Zen) hosts both the free L1
// roster (big-pickle and every *-free id) and paid models, so a provider-level
// label would skip the entire L1 tier in the default no-cost run.
function tierOf(model) {
  const i = model.indexOf('/'), prov = model.slice(0, i), id = model.slice(i + 1);
  if (prov === 'ollama') return 'local';
  if (prov === 'opencode' && (id === 'big-pickle' || id.endsWith('-free'))) return 'free';
  return 'paid';
}

// Two ways to hand a model an image, and they are NOT interchangeable:
//   INLINE  a base64 data: URL - the bytes travel in the request
//   REMOTE  a public https URL - the backend fetches it
// A local chart can only be sent INLINE, so INLINE is the capability that
// decides whether anything this machine produces can be verified. Measured
// result across this roster: INLINE works everywhere vision works at all, and
// REMOTE fails everywhere - the reverse of what the catalogs imply.
//
// The image below is a solid red 64x64 PNG. It is deliberately NOT a 1x1
// pixel: several backends reject a degenerate image with "failed to decode",
// which reads exactly like "this model is blind" and is not.
const IMG_INLINE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAT0lEQVR42u3PQQkAAAgEsItz/fMYxgi+hcEKLNO+FgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQGBywLzk8EPlvGqjQAAAABJRU5ErkJggg==';
const IMG_REMOTE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/' +
  'PNG_transparency_demonstration_1.png/120px-PNG_transparency_demonstration_1.png';

const TOOL = [{
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get the current weather for a city.',
    parameters: {
      type: 'object',
      properties: { city: { type: 'string', description: 'City name' } },
      required: ['city'],
    },
  },
}];

async function post(url, headers, body, timeoutMs) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  const started = Date.now();
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await r.text().catch(() => '');
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON error page */ }
    return { status: r.status, json, text, ms: Date.now() - started };
  } catch (e) {
    return { status: 0, json: null, text: String(e.message || e), ms: Date.now() - started };
  } finally { clearTimeout(t); }
}

function errOf(r) {
  if (r.status === 0) return r.text.includes('abort') ? 'timeout' : r.text.slice(0, 60);
  const m = r.json && r.json.error && (r.json.error.message || r.json.error.type);
  return (m || r.text.slice(0, 60) || 'HTTP ' + r.status).slice(0, 70);
}

// models.dev tells us which models claim image input; without the catalog the
// vision probe is simply skipped rather than guessed at.
function loadCatalog() {
  for (const p of [process.env.MODELS_JSON, path.join(ROOT, 'models.json')]) {
    if (p && fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* ignore */ } }
  }
  return null;
}

function agentPins() {
  const dir = path.join(ROOT, 'agents');
  const out = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
    const name = f.replace(/\.md$/, '');
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const model = (src.match(/^model:\s*(\S+)/m) || [])[1];
    if (model) out.push({ name, model });
  }
  return out;
}

// Shared with verify-config.cjs via scripts/lib/families.cjs - the family
// names must match agents/orchestrator.md §8 exactly. The module is pure
// string mapping, so this script still runs without the models.dev catalog.
const { family } = require(path.join(__dirname, 'lib', 'families.cjs'));

function chains() {
  const src = fs.readFileSync(path.join(ROOT, 'agents', 'orchestrator.md'), 'utf8');
  const start = src.indexOf('## Fallback chains');
  if (start < 0) return null;
  const block = src.slice(start, src.indexOf('Rules:', start));
  const out = [];
  // split on \r?\n: JS "." does not match \r, so on a CRLF checkout the $
  // anchor below would never match and every chain would look unparseable.
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^(\w+)\s+(.+─▶.+)$/);
    if (m) out.push({ kind: m[1], steps: m[2].split('──▶').map(s => s.trim()).filter(Boolean) });
  }
  return out;
}

(async () => {
  const catalog = loadCatalog();
  const pins = agentPins().filter(a => !ONLY || a.name === ONLY);
  const results = {};

  log('-- live agent calls --');
  log('   tier     agent               TEXT   TOOLS  VISION  ms     model');

  for (const { name, model } of pins) {
    const prov = model.slice(0, model.indexOf('/'));
    const id = model.slice(model.indexOf('/') + 1);
    const mk = ENDPOINT[prov];
    if (!mk) { results[name] = { skipped: 'no endpoint mapping for ' + prov }; continue; }
    const k = prov === 'ollama' ? 'ollama' : key(prov);
    if (!k) { results[name] = { skipped: 'provider not authenticated' }; continue; }
    const [url, headers] = mk(k);
    const tier = tierOf(model);
    if (tier === 'paid' && !PAID) { results[name] = { skipped: 'paid tier (pass --paid)' }; continue; }

    // Local models are called cold: the first request to a 70B includes load
    // time, which is minutes, not seconds.
    const timeout = tier === 'local' ? 300000 : 90000;
    const r = { tier, model };

    const text = await post(url, headers, {
      model: id, max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    }, timeout);
    r.text = { ok: text.status === 200 && !!(text.json && text.json.choices), status: text.status, ms: text.ms };
    if (!r.text.ok) r.text.error = errOf(text);

    if (r.text.ok) {
      // Tool choice is probabilistic: a model can answer in prose on one
      // attempt and emit the call on the next. One miss is not evidence that
      // it cannot call tools, so escalate tool_choice before believing a FAIL.
      let tool = null, msg = null;
      for (const choice of ['auto', 'required']) {
        tool = await post(url, headers, {
          model: id, max_tokens: 128, tools: TOOL, tool_choice: choice,
          messages: [{ role: 'user', content: 'What is the weather in Paris? Use the tool.' }],
        }, timeout);
        msg = tool.json && tool.json.choices && tool.json.choices[0] && tool.json.choices[0].message;
        if (msg && msg.tool_calls && msg.tool_calls.length) break;
      }
      r.tools = { ok: !!(msg && msg.tool_calls && msg.tool_calls.length), status: tool.status, ms: tool.ms };
      // A 200 with prose instead of a call is a capability answer, not an
      // error - reporting the raw completion body as "the error" is noise.
      if (!r.tools.ok) r.tools.error = tool.status === 200
        ? 'answered in prose, emitted no tool_call (even with tool_choice=required)'
        : errOf(tool);

      const claimsVision = catalog && catalog[prov] && catalog[prov].models[id] &&
        (catalog[prov].models[id].modalities || {}).input || [];
      if (Array.isArray(claimsVision) && claimsVision.includes('image')) {
        const seeImage = async src => {
          // 200 proves the image was accepted; naming the colour proves it was
          // actually looked at. Reasoning models need room to answer, and some
          // put the answer in `reasoning` rather than `content`.
          const v = await post(url, headers, {
            model: id, max_tokens: 200,
            messages: [{
              role: 'user', content: [
                { type: 'text', text: 'What colour fills this image?' },
                { type: 'image_url', image_url: { url: src } },
              ],
            }],
          }, timeout);
          const msg = v.json && v.json.choices && v.json.choices[0] && v.json.choices[0].message;
          const said = String((msg && (msg.content || msg.reasoning)) || '');
          return {
            ok: v.status === 200 && !!msg,
            named: /red|crimson|scarlet|orange/i.test(said),
            status: v.status, err: errOf(v),
          };
        };
        const remote = await seeImage(IMG_REMOTE);
        const inline = await seeImage(IMG_INLINE);
        r.vision = {
          ok: remote.ok || inline.ok,
          remote: remote.ok,
          inline: inline.ok,          // the one that matters for local files
          named: inline.named || remote.named,
          status: inline.status,
        };
        // Report both paths: they fail for different reasons and the fix
        // differs (host the file vs. give up on that provider for images).
        if (!r.vision.ok) r.vision.error = 'remote: ' + remote.err + ' | inline: ' + inline.err;
        else if (!inline.ok) r.vision.error = 'remote URLs only - rejects inline base64, so it cannot read a local file';
        else if (!r.vision.named) r.vision.error = 'accepted the image but did not describe it correctly';
      }
    }

    results[name] = r;
    const cell = (x, yes, no) => !x ? '  -   ' : x.ok ? yes : no;
    if (r.vision && r.vision.ok && !r.vision.inline) r.vision.partial = true;
    log('   ' + tier.padEnd(8) + ' ' + name.padEnd(19) +
      cell(r.text, ' PASS ', ' FAIL ') + cell(r.tools, ' PASS ', ' FAIL ') +
      (!r.vision ? '  -    ' : r.vision.inline ? ' PASS  ' : r.vision.ok ? ' PART  ' : ' FAIL  ') +
      String(r.text.ms).padStart(6) + '  ' + model);
    if (r.text && !r.text.ok) log('            -> TEXT  ' + r.text.error);
    else {
      if (r.tools && !r.tools.ok) log('            -> TOOLS ' + r.tools.error);
      if (r.vision && r.vision.error) log('            -> VISION ' + r.vision.error);
    }
  }

  const skipped = Object.entries(results).filter(([, v]) => v.skipped);
  if (skipped.length) {
    log('\n   skipped: ' + skipped.map(([n, v]) => n + ' (' + v.skipped + ')').join(', '));
  }

  // ---- design invariants ------------------------------------------------
  let fail = 0;
  const bad = m => { console.log('FAIL ' + m); fail++; };
  const live = n => !!(results[n] && results[n].text && results[n].text.ok);
  const canEdit = n => live(n) && !!(results[n].tools && results[n].tools.ok);
  const tested = n => !!(results[n] && !results[n].skipped);

  log('\n-- invariant 1: every fallback chain has a live step --');
  const ch = chains();
  if (!ch || !ch.length) bad('could not parse the fallback chains out of agents/orchestrator.md');
  else for (const c of ch) {
    const names = c.steps.map(s => s.split(/\s/)[0]);
    const first = names.find(live);
    const anyTested = names.some(tested);
    if (first) {
      // "down" and "not tested in this run" are different facts; conflating
      // them would have this script report a healthy primary as failed.
      const why = names[0] === first ? ''
        : tested(names[0]) ? '  (primary ' + names[0] + ' is DOWN)'
          : '  (primary ' + names[0] + ' untested in this tier selection)';
      log('  OK   ' + c.kind.padEnd(10) + '-> ' + first + why);
    }
    else if (!anyTested) log('  ?    ' + c.kind.padEnd(10) + 'no step tested in this tier selection');
    else bad('chain "' + c.kind + '" has no live step: ' + names.join(' -> '));
  }

  log('\n-- invariant 2: cross-model validation is achievable --');
  {
    const impl = ['free-coder', 'coder', 'pickle-coder', 'local-coder'].filter(canEdit);
    const vals = ['free-validator', 'reviewer', 'validator', 'local-validator'].filter(live);
    const implTested = ['free-coder', 'coder', 'pickle-coder', 'local-coder'].some(tested);
    const valsTested = ['free-validator', 'reviewer', 'validator', 'local-validator'].some(tested);
    if (!implTested || !valsTested) log('  ?    not enough of the roster tested to judge (run without --agent)');
    else if (!impl.length) bad('no live implementer that can call tools - nothing can edit a file');
    else if (!vals.length) bad('no live validator - work would ship unvalidated');
    else {
      const pair = impl.flatMap(i => vals.map(v => [i, v]))
        .find(([i, v]) => family(results[i].model) !== family(results[v].model));
      if (!pair) bad('every live validator shares a family with every live implementer: ' +
        impl.join(',') + ' vs ' + vals.join(','));
      else log('  OK   ' + pair[0] + ' (' + family(results[pair[0]].model) + ') validated by ' +
        pair[1] + ' (' + family(results[pair[1]].model) + ')');
    }
  }

  log('\n-- invariant 3: the router itself is live --');
  if (!tested('orchestrator')) log('  ?    orchestrator not tested (paid tier; pass --paid)');
  else if (!live('orchestrator')) bad('orchestrator is DOWN - every request fails, not just its own tier');
  else log('  OK   orchestrator answers');

  log('\n-- invariant 4: something can read an image --');
  {
    const seers = Object.entries(results).filter(([, v]) => v.vision && v.vision.inline).map(([n]) => n);
    const partial = Object.entries(results).filter(([, v]) => v.vision && v.vision.ok && !v.vision.inline).map(([n]) => n);
    if (seers.length) log('  OK   ' + seers.join(', ') + ' can read a local image file');
    else if (partial.length && !ONLY) bad('no live agent accepts an inline image - ' + partial.join(', ') +
      ' can only read images already published at a public URL, so nothing can verify a local chart or screenshot');
    else if (ONLY) log('  ?    single-agent run - not evidence about the roster');
    else if (!Object.values(results).some(v => v.vision)) log('  ?    no vision-capable agent was tested');
    else bad('no live agent can read an image - charts, screenshots and diagrams cannot be verified');
  }

  if (JSON_OUT) console.log(JSON.stringify({ results, failures: fail }, null, 2));
  log('\n' + (fail ? fail + ' INVARIANT FAILURE(S)' : 'ALL INVARIANTS HOLD'));
  process.exitCode = fail ? 1 : 0;
})();
