// Preflight: what can actually run right now.
//
//   node scripts/preflight.cjs [--json]
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

const JSON_OUT = process.argv.includes('--json');
const OLLAMA = 'http://192.168.86.24:11434';
const AUTH = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');

// The router itself runs on deepseek/deepseek-v4-pro. That is a deliberate
// choice - see agents/orchestrator.md - and it means DeepSeek hitting zero
// stops EVERY request, not just the DeepSeek-tier ones. So warn early and
// loudly rather than at the moment it fails.
// Overridable so the warning path can be exercised without draining an account:
//   DEEPSEEK_LOW_USD=999 node scripts/preflight.cjs
const DEEPSEEK_LOW_USD = Number(process.env.DEEPSEEK_LOW_USD || 10);
const DEEPSEEK_CRITICAL_USD = Number(process.env.DEEPSEEK_CRITICAL_USD || 2);

const out = { authed: {}, ollama: null, balances: {}, reachable: {}, agents: {}, reload: null };
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
    return v && (v.key || v.apiKey || v.access);
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

  log('  -    kimi-for-coding subscription: no balance API. 429/402 at call time is the only signal.');
  log('  -    openrouter      free tier: no balance API. 429 at call time is the only signal.');
  log('  -    google          no balance API exposed here.');

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
      ok = !!out.authed[prov];
      why = ok ? 'provider authed' : 'PROVIDER NOT AUTHED - run: opencode auth login -> ' + prov;
    }
    out.agents[name] = { model: m, usable: ok, reason: why };
    rows.push([ok, name, m, why]);
  }
  for (const [ok, name, m, why] of rows)
    log('  ' + (ok ? 'OK  ' : 'DEAD') + ' ' + name.padEnd(19) + m.padEnd(48) + (ok ? '' : why));

  const dead = rows.filter(r => !r[0]);
  log('\n' + (rows.length - dead.length) + '/' + rows.length + ' agents usable' +
    (dead.length ? '; ' + dead.length + ' unreachable: ' + dead.map(r => r[1]).join(', ') : ''));

  if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
  // exitCode rather than process.exit(): forcing exit while fetch keepalive
  // sockets are still open trips a libuv assertion on Windows.
  // 2 = credit needs reloading (louder than 1, which is just an unusable agent)
  process.exitCode = out.reload ? 2 : dead.length ? 1 : 0;
})();
