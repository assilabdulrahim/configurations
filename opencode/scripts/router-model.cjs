// Which model runs the router (agents/orchestrator.md). K3 when it is live,
// DeepSeek Flash when it is not.
//
//   node scripts/router-model.cjs auto        # probe Kimi, pin whichever is live
//   node scripts/router-model.cjs kimi        # force K3 (subscription)
//   node scripts/router-model.cjs deepseek    # force DeepSeek Flash (metered)
//   node scripts/router-model.cjs status      # print the current pin, change nothing
//   ... --dest <dir>                          # config dir (default ~/.config/opencode)
//
// WHY A SCRIPT. The router is the primary agent, and opencode cannot fail a
// primary agent over: when its provider returns 429/402 every request fails,
// including the ones that would never have touched that provider. So the
// fallback has to happen BEFORE the session starts, by rewriting the pin. Run
// `auto` from a daily scheduled task and the router is on K3 whenever the Kimi
// quota is there, and on DeepSeek on the days it is not - without anyone
// remembering to switch it back.
//
// It edits the DEPLOYED copy only. The repo pins K3, which is the intended
// state; a DeepSeek pin in the deployed copy is a temporary condition, and
// sync-check.cjs reports it as such rather than as drift.
//
// A running session keeps the model it started with. The new pin applies to the
// next session.

const fs = require('fs');
const os = require('os');
const path = require('path');

const PINS = {
  kimi: 'kimi-for-coding/k3',
  deepseek: 'deepseek/deepseek-flash',
};
const KIMI_URL = 'https://api.kimi.com/coding/v1/chat/completions';
const KIMI_MODEL = 'k3';
const PROBE_TIMEOUT_MS = 30000;

const argv = process.argv.slice(2);
const mode = argv.find(a => !a.startsWith('--')) || 'status';
let DEST = path.join(os.homedir(), '.config', 'opencode');
if (argv.includes('--dest')) {
  const v = argv[argv.indexOf('--dest') + 1];
  if (!v || v.startsWith('--')) { console.error('router-model: --dest needs a directory path'); process.exit(2); }
  DEST = v;
}
if (!['auto', 'kimi', 'deepseek', 'status'].includes(mode)) {
  console.error('router-model: expected auto | kimi | deepseek | status, got "' + mode + '"');
  process.exit(2);
}

const FILE = path.join(DEST, 'agents', 'orchestrator.md');
const MODEL_LINE = /^model:[ \t]*(\S+)/m;

function currentPin() {
  const m = fs.readFileSync(FILE, 'utf8').match(MODEL_LINE);
  if (!m) throw new Error('no "model:" line in ' + FILE + ' - refusing to guess where the pin is');
  return m[1];
}

function writePin(model) {
  const src = fs.readFileSync(FILE, 'utf8');
  fs.writeFileSync(FILE, src.replace(MODEL_LINE, 'model: ' + model));
}

// Same credential sources opencode uses: auth.json first, then the environment.
function kimiKey() {
  const auth = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
  try {
    const v = JSON.parse(fs.readFileSync(auth, 'utf8'))['kimi-for-coding'];
    const k = v && (v.key || v.apiKey || v.access);
    if (k) return k;
  } catch { /* fall through to the environment */ }
  return process.env.KIMI_API_KEY || null;
}

// A one-token completion, not a /models call: /models answers 200 on an
// exhausted quota. Only a real completion says whether work would succeed.
async function probeKimi() {
  const key = kimiKey();
  if (!key) return { live: false, why: 'no kimi-for-coding credential' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PROBE_TIMEOUT_MS);
  try {
    const r = await fetch(KIMI_URL, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: KIMI_MODEL, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
    });
    if (r.ok) return { live: true, why: 'HTTP ' + r.status };
    const body = (await r.text()).replace(/\s+/g, ' ').slice(0, 160);
    return { live: false, why: 'HTTP ' + r.status + ' ' + body };
  } catch (e) {
    return { live: false, why: e.name === 'AbortError' ? 'timed out after ' + PROBE_TIMEOUT_MS + 'ms' : String(e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  if (!fs.existsSync(FILE)) { console.error('router-model: no ' + FILE); process.exit(2); }
  const before = currentPin();
  if (mode === 'status') { console.log('router: ' + before); return; }

  let want = PINS[mode];
  if (mode === 'auto') {
    const p = await probeKimi();
    want = p.live ? PINS.kimi : PINS.deepseek;
    console.log('kimi probe: ' + (p.live ? 'LIVE' : 'DOWN') + ' (' + p.why + ')');
  }

  if (want === before) { console.log('router: ' + before + ' (unchanged)'); return; }
  writePin(want);
  console.log('router: ' + before + ' -> ' + want);
  console.log('Applies to the next opencode session; a running one keeps its model.');
})().catch(e => { console.error('router-model: ' + (e.message || e)); process.exit(1); });
