// Preflight: what can actually run right now.
//
//   node scripts/preflight.cjs [--json] [--version]
//
// Answers three questions the router cannot answer by reasoning:
//   1. Which providers are authenticated?  (so which agents are reachable)
//   2. Is the local Ollama box up, and which models are loaded?
//   3. Where a balance API exists, how much credit is left?
//
// Never prints credential values - only provider ids and credential types.
//
// HONEST LIMITS: only DeepSeek and Moonshot publish a balance endpoint.
// Subscription plans (kimi-for-coding) and OpenRouter free tiers expose no
// pre-flight quota. For those the only reliable signal is a 402/429 at call
// time, which is why agents/orchestrator.md defines a fallback chain.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// --version: print the config directory's own git HEAD and stop. The config
// lives outside the project repos it serves, so this is the SHA of the
// config's repository, not of the repo the router happens to be running in.
if (process.argv.includes('--version')) {
  try {
    const sha = execSync('git rev-parse HEAD', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    console.log(sha);
  } catch (e) {
    // Exit non-zero: a caller pinning a run to a config SHA must be able to
    // tell "here is the SHA" from "there is no SHA" (no git, or a deployed
    // copy that is not a checkout). Printing the error and exiting 0 reads
    // as success to every caller that checks the status code.
    console.error(String((e && e.stderr) || (e && e.message) || e).trim());
    process.exit(1);
  }
  process.exit(0);
}

// Global fetch is Node 18+. Without this the failure is a bare ReferenceError
// from inside head(), which reads like a bug in this script rather than an
// old runtime.
if (typeof fetch !== 'function') {
  console.error('preflight needs Node 18+ for global fetch (running ' + process.version + ').');
  process.exit(2);
}

const JSON_OUT = process.argv.includes('--json');
const OLLAMA = 'http://192.168.86.24:11434';
const AUTH = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');

// A provider can be authenticated by environment variable instead of auth.json -
// models.dev declares one per provider, and the desktop app inherits the user's
// environment the same way the CLI does. Without this, a key supplied that way
// reads as PROVIDER NOT AUTHED and every agent on it is reported DEAD while in
// fact working. That false negative is worse than no check at all: it sends you
// re-authenticating a provider that was never broken.
const ENV_KEYS = { anthropic: 'ANTHROPIC_API_KEY' };

// The router itself runs on deepseek/deepseek-v4-pro. That is a deliberate
// choice - see agents/orchestrator.md - and it means DeepSeek hitting zero
// stops EVERY request, not just the DeepSeek-tier ones. So warn early and
// loudly rather than at the moment it fails.
// Overridable so the warning path can be exercised without draining an account:
//   DEEPSEEK_LOW_USD=999 node scripts/preflight.cjs
const DEEPSEEK_LOW_USD = Number(process.env.DEEPSEEK_LOW_USD || 10);
const DEEPSEEK_CRITICAL_USD = Number(process.env.DEEPSEEK_CRITICAL_USD || 2);

const out = { authed: {}, ollama: null, balances: {}, credentials: {}, reachable: {}, agents: {}, reload: null };
const log = (...a) => { if (!JSON_OUT) console.log(...a); };

function reloadNotice(bal, cur, state) {
  const amount = isNaN(bal) ? 'unknown' : bal.toFixed(2) + ' ' + cur;
  const head = state === 'EMPTY'
    ? 'DEEPSEEK IS OUT OF CREDIT'
    : 'DEEPSEEK CREDIT ' + state + ' - ' + amount + ' left';
  log('');
  log('  ' + '='.repeat(68));
  log('  ** ' + head);
  log('  ' + '='.repeat(68));
  log('  The router itself runs on deepseek/deepseek-v4-pro. At zero it stops');
  log('  and cannot re-route itself, so EVERY request fails - not only the');
  log('  ones that would have used DeepSeek.');
  log('');
  log('  RELOAD:   https://platform.deepseek.com  ->  Top up / Billing');
  log('');
  log('  Or move the router to the flat-cost standby (1M context, no metering):');
  log('    sed -i "s|^model: deepseek/.*|model: kimi-for-coding/k3|" \\');
  log('      agents/orchestrator.md');
  log('');
  log('  Then re-run: node scripts/preflight.cjs');
  log('  ' + '='.repeat(68));
  log('');
}

async function head(url, headers, timeoutMs = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers, signal: ac.signal });
    return { status: r.status, body: await r.text().catch(() => '') };
  } catch (e) {
    return { status: 0, body: String(e.message || e) };
  } finally { clearTimeout(t); }
}

(async () => {
  // ---- 1. authenticated providers -------------------------------------
  let auth = {};
  try {
    auth = JSON.parse(fs.readFileSync(AUTH, 'utf8'));
  } catch {
    log('WARN  no auth.json at ' + AUTH + ' - treating every cloud provider as unauthenticated');
  }
  for (const [id, v] of Object.entries(auth)) out.authed[id] = (v && v.type) || typeof v;
  // Env vars are a second, equally valid source - report which one is in play so
  // "authenticated" is never ambiguous about where the credential came from.
  for (const [id, envVar] of Object.entries(ENV_KEYS))
    if (!out.authed[id] && process.env[envVar]) out.authed[id] = 'env:' + envVar;

  log('-- authenticated providers --');
  for (const [id, t] of Object.entries(out.authed)) log('  OK   ' + id.padEnd(20) + t);
  if (!Object.keys(out.authed).length) log('  (none)');

  // ---- 2. local ollama -------------------------------------------------
  log('\n-- local ollama (' + OLLAMA + ') --');
  const tags = await head(OLLAMA + '/api/tags');
  if (tags.status === 200) {
    const models = JSON.parse(tags.body).models.map(m => m.name);
    out.ollama = models;
    log('  OK   reachable, ' + models.length + ' models: ' + models.join(', '));
  } else {
    log('  DOWN unreachable (' + (tags.status || tags.body) + ') - the whole local tier is unavailable');
  }

  // ---- 3. balances, where an API exists --------------------------------
  log('\n-- credit --');
  const key = id => {
    const v = auth[id];
    return (v && (v.key || v.apiKey || v.access)) ||
      (ENV_KEYS[id] && process.env[ENV_KEYS[id]]) || undefined;
  };

  if (key('deepseek')) {
    const r = await head('https://api.deepseek.com/user/balance',
      { Authorization: 'Bearer ' + key('deepseek') });
    if (r.status === 200) {
      const b = JSON.parse(r.body);
      const info = (b.balance_infos || [])[0] || {};
      const bal = parseFloat(info.total_balance);
      const cur = info.currency || '';
      const state = !b.is_available || !(bal > 0) ? 'EMPTY'
        : bal < DEEPSEEK_CRITICAL_USD ? 'CRITICAL'
          : bal < DEEPSEEK_LOW_USD ? 'LOW' : 'OK';
      out.balances.deepseek = { available: b.is_available, total: bal, currency: cur, state };
      out.reload = state === 'OK' ? null : state;
      log('  ' + (state === 'OK' ? 'OK  ' : state.padEnd(4)) + ' deepseek        ' +
        (isNaN(bal) ? '?' : bal.toFixed(2)) + ' ' + cur);
      if (state !== 'OK') reloadNotice(bal, cur, state);
    } else log('  ?    deepseek        balance query returned ' + r.status);
  } else log('  -    deepseek        not authenticated');

  if (key('moonshotai')) {
    const r = await head('https://api.moonshot.ai/v1/users/me/balance',
      { Authorization: 'Bearer ' + key('moonshotai') });
    if (r.status === 200) {
      const d = (JSON.parse(r.body) || {}).data || {};
      out.balances.moonshotai = d;
      log('  OK   moonshotai      available ' + d.available_balance);
    } else log('  ?    moonshotai      balance query returned ' + r.status);
  } else log('  -    moonshotai      not authenticated');

  // openrouter used to be free-tier only, where the first sign of trouble was
  // a 429 at call time. It is metered now - glm-coder sits in three fallback
  // chains - and it does expose a balance, so read it rather than guess.
  if (key('openrouter')) {
    const r = await head('https://openrouter.ai/api/v1/credits',
      { Authorization: 'Bearer ' + key('openrouter') });
    if (r.status === 200) {
      const d = (JSON.parse(r.body) || {}).data || {};
      const left = Number(d.total_credits) - Number(d.total_usage);
      const state = !(left > 0) ? 'EMPTY'
        : left < DEEPSEEK_CRITICAL_USD ? 'CRITICAL'
          : left < DEEPSEEK_LOW_USD ? 'LOW' : 'OK';
      out.balances.openrouter = { total: d.total_credits, used: d.total_usage, left, state };
      log('  ' + (state === 'OK' ? 'OK  ' : state.padEnd(4)) + ' openrouter      ' +
        (isNaN(left) ? '?' : left.toFixed(2)) + ' USD left of ' + d.total_credits);
    } else log('  ?    openrouter      balance query returned ' + r.status);
  } else log('  -    openrouter      not authenticated');

  log('  -    kimi-for-coding subscription: no balance API. 429/402 at call time is the only signal.');
  log('  -    google          metered via Cloud billing; no balance API exposed here.');
  // A workspace key (sk-ant-api...) can spend but cannot read spend: the usage
  // and cost reports live behind a separate Admin key (sk-ant-admin...), which
  // in turn cannot call the Messages API. So LIVE below means the key works,
  // never that the account is funded - the two are genuinely different facts here.
  log('  -    anthropic       metered; a workspace key exposes no balance. Spend is readable');
  log('                       only with a separate sk-ant-admin key. LIVE != funded.');

  // ---- 3b. does each credential actually WORK? ------------------------
  // A key sitting in auth.json proves nothing: a revoked OpenRouter key is
  // still well-formed, and the failure only shows up mid-task as
  // `User not found`. Every provider that offers a cheap read-only endpoint
  // gets probed here so a dead credential is a preflight failure, not a
  // surprise three tool calls into a session.
  //
  // Note the OpenRouter attribution headers: some free models (inkling) return
  // 403 "only available on agentic harnesses" without them, so a probe that
  // omitted them would report a false DEAD.
  const OR_HEADERS = k => ({
    Authorization: 'Bearer ' + k,
    'HTTP-Referer': 'https://opencode.ai',
    'X-Title': 'opencode',
  });
  const PROBES = {
    openrouter: k => ['https://openrouter.ai/api/v1/key', OR_HEADERS(k)],
    deepseek: k => ['https://api.deepseek.com/models', { Authorization: 'Bearer ' + k }],
    'kimi-for-coding': k => ['https://api.kimi.com/coding/v1/models', { Authorization: 'Bearer ' + k }],
    moonshotai: k => ['https://api.moonshot.ai/v1/models', { Authorization: 'Bearer ' + k }],
    google: k => ['https://generativelanguage.googleapis.com/v1beta/models?key=' +
      encodeURIComponent(k), {}],
    // anthropic authenticates with x-api-key, NOT `Authorization: Bearer` like
    // every other entry here - a Bearer header is simply ignored and the call
    // comes back 401, which reads as a revoked key rather than a wrong header.
    // anthropic-version is mandatory on every request, including this one.
    anthropic: k => ['https://api.anthropic.com/v1/models',
      { 'x-api-key': k, 'anthropic-version': '2023-06-01' }],
    // opencode (Zen) previously had no probe at all, despite hosting the ENTIRE
    // L1 free tier - five agents ride on this one credential and preflight could
    // not tell you if it was dead. Verified live: 200 with a models list.
    opencode: k => ['https://opencode.ai/zen/v1/models', { Authorization: 'Bearer ' + k }],
    minimax: k => ['https://api.minimax.io/v1/models', { Authorization: 'Bearer ' + k }],
  };

  log('\n-- credential liveness --');
  for (const prov of Object.keys(out.authed)) {
    const k = key(prov);
    const mk = PROBES[prov];
    if (!mk || !k) {
      out.credentials[prov] = { state: 'UNVERIFIED', detail: 'no cheap probe endpoint' };
      log('  ?    ' + prov.padEnd(20) + 'UNVERIFIED - no probe endpoint; 401 at call time is the only signal');
      continue;
    }
    const [url, headers] = mk(k);
    const r = await head(url, headers);
    // 400 is here because Google answers an invalid key with 400, not 401.
    const state = r.status >= 200 && r.status < 300 ? 'LIVE'
      : [400, 401, 403].includes(r.status) ? 'REJECTED'
        : r.status === 429 ? 'RATE_LIMITED' : 'UNREACHABLE';
    let detail = '';
    try { const j = JSON.parse(r.body); detail = (j.error && (j.error.message || j.error.status)) || ''; }
    catch { detail = r.status ? '' : String(r.body).slice(0, 60); }
    out.credentials[prov] = { state, status: r.status, detail };
    const tag = { LIVE: 'OK  ', REJECTED: 'DEAD', RATE_LIMITED: 'WARN', UNREACHABLE: 'WARN' }[state];
    log('  ' + tag + ' ' + prov.padEnd(20) + state + (r.status ? ' (' + r.status + ')' : '') +
      (detail ? ' - ' + detail.slice(0, 70) : ''));
    if (state === 'REJECTED')
      log('       every agent on this provider is unusable - re-auth in the app' +
        (ENV_KEYS[prov] ? ', or fix ' + ENV_KEYS[prov] : '') +
        ', or: opencode auth login -> ' + prov);
  }

  // ---- 4. can each agent's provider actually be used? -----------------
  log('\n-- agent reachability --');
  const agentsDir = path.join(__dirname, '..', 'agents');
  const rows = [];
  for (const f of fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).sort()) {
    const name = f.replace(/\.md$/, '');
    const m = (fs.readFileSync(path.join(agentsDir, f), 'utf8').match(/^model:\s*(\S+)/m) || [])[1];
    if (!m) continue;
    const prov = m.slice(0, m.indexOf('/'));
    const id = m.slice(m.indexOf('/') + 1);
    let ok, why;
    if (prov === 'ollama') {
      ok = !!(out.ollama && out.ollama.includes(id));
      why = out.ollama ? (ok ? 'pulled' : 'NOT PULLED') : 'ollama unreachable';
    } else {
      const cred = out.credentials[prov];
      if (!out.authed[prov]) {
        ok = false;
        why = 'PROVIDER NOT AUTHED - add it in the app (Providers), or set ' +
          (ENV_KEYS[prov] || 'its API key env var') + ', or: opencode auth login -> ' + prov;
      }
      else if (cred && cred.state === 'REJECTED') { ok = false; why = 'CREDENTIAL REJECTED (' + cred.status + ') - re-auth: opencode auth login -> ' + prov; }
      else if (cred && cred.state === 'LIVE') { ok = true; why = 'credential verified live'; }
      else { ok = true; why = 'key present, NOT verified'; }
    }
    out.agents[name] = { model: m, usable: ok, reason: why };
    rows.push([ok, name, m, why]);
  }
  for (const [ok, name, m, why] of rows)
    log('  ' + (ok ? (why === 'key present, NOT verified' ? 'OK? ' : 'OK  ') : 'DEAD') +
      ' ' + name.padEnd(19) + m.padEnd(48) + (ok && why.startsWith('credential') ? '' : why));

  const dead = rows.filter(r => !r[0]);
  log('\n' + (rows.length - dead.length) + '/' + rows.length + ' agents usable' +
    (dead.length ? '; ' + dead.length + ' unreachable: ' + dead.map(r => r[1]).join(', ') : ''));

  if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
  // exitCode rather than process.exit(): forcing exit while fetch keepalive
  // sockets are still open trips a libuv assertion on Windows.
  // 2 = credit needs reloading (louder than 1, which is just an unusable agent)
  process.exitCode = out.reload ? 2 : dead.length ? 1 : 0;
})();
