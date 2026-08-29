// Verifies the opencode config against reality. Run from the opencode/ dir:
//   node scripts/verify-config.cjs <dir with models.json and tags.json>
// See scripts/README.md for how to fetch those two catalogs.
const fs = require('fs');
const SP = process.argv[2] || '.';
const BACKSLASH = String.fromCharCode(92);

// string-aware JSONC stripper (must not eat the "//" inside an http:// URL)
function stripJsonc(s) {
  let out = '', inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (inStr) {
      out += c;
      if (esc) esc = false;
      else if (c === BACKSLASH) esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i++; continue; }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

let fail = 0;
const bad = m => { console.log('FAIL ' + m); fail++; };

const cfg = JSON.parse(stripJsonc(fs.readFileSync('opencode.jsonc', 'utf8')));
console.log('OK   opencode.jsonc parses as JSONC');

const md = require(SP + '/models.json');
const local = new Set(require(SP + '/tags.json').models.map(m => m.name));
const agentFiles = fs.readdirSync('agents').filter(f => f.endsWith('.md'));
const agents = new Set(agentFiles.map(f => f.replace(/\.md$/, '')));
const pin = a => (fs.readFileSync('agents/' + a + '.md', 'utf8').match(/^model:\s*(\S+)/m) || [])[1];

// --- 1. every agent pins a model that actually resolves, with tool calling
console.log('\n-- agent model pins --');
for (const a of [...agents].sort()) {
  const m = pin(a);
  if (!m) { bad(a + ': no model pin'); continue; }
  const i = m.indexOf('/'), p = m.slice(0, i), id = m.slice(i + 1);
  if (p === 'ollama') {
    if (!local.has(id)) bad(a + ' -> ' + m + ' NOT PULLED on the ollama box');
    else console.log('OK   ' + a.padEnd(19) + m);
  } else {
    const e = md[p] && md[p].models[id];
    if (!e) bad(a + ' -> ' + m + ' NOT IN models.dev');
    else if (!e.tool_call) bad(a + ' -> ' + m + ' HAS NO TOOL CALLING (cannot drive an agent)');
    else {
      // models.dev reports cost 0 for subscription PLANS too, so classify by provider
      const cls = p === 'opencode' ? 'FREE' : /^(kimi-for-coding|anthropic)$/.test(p) ? 'SUBSCRIPTION' : 'metered';
      console.log('OK   ' + a.padEnd(19) + m.padEnd(46) + 'ctx=' + String(e.limit.context).padEnd(9) + cls);
    }
  }
}

// --- 2. router allow-list matches the agents on disk
console.log('\n-- router wiring --');
const orch = fs.readFileSync('agents/orchestrator.md', 'utf8');
const named = [...orch.split('  task:')[1].split('---')[0].matchAll(/^\s+"([a-z-]+)":\s*allow/gm)].map(m => m[1]);
for (const a of named) if (!agents.has(a)) bad('router may call missing agent: ' + a);
console.log('OK   router allow-list: ' + named.length + ' agents, all exist');
for (const a of agents) if (a !== 'orchestrator' && !named.includes(a)) console.log('WARN unreachable from router: ' + a);

// --- 3. skills are well formed, and every skill the router names exists
console.log('\n-- skills --');
const skills = new Set();
for (const d of fs.readdirSync('skills', { withFileTypes: true }).filter(d => d.isDirectory())) {
  const p = 'skills/' + d.name + '/SKILL.md';
  if (!fs.existsSync(p)) { bad('skills/' + d.name + ': no SKILL.md'); continue; }
  const fm = fs.readFileSync(p, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) { bad(p + ': no frontmatter'); continue; }
  const name = (fm[1].match(/^name:\s*(\S+)/m) || [])[1];
  const desc = (fm[1].match(/^description:\s*(.+)$/m) || [])[1];
  if (name !== d.name) bad(p + ': frontmatter name "' + name + '" != directory "' + d.name + '"');
  else if (!desc) bad(p + ': no description');
  else {
    skills.add(name);
    const refs = fs.existsSync('skills/' + name + '/references')
      ? fs.readdirSync('skills/' + name + '/references').length : 0;
    console.log('OK   ' + name.padEnd(19) + refs + ' reference file(s)');
  }
}
for (const s of [...orch.matchAll(/^\| [^|]+ \| `([a-z-]+)` \| `([a-z-]+)` \|$/gm)]) {
  if (!skills.has(s[1])) bad('router routes to missing skill: ' + s[1]);
  if (!agents.has(s[2])) bad('router routes skill ' + s[1] + ' to missing agent: ' + s[2]);
}
console.log('OK   router skill table resolves');

// --- 4. commands point at real agents
console.log('\n-- commands --');
for (const [n, c] of Object.entries(cfg.command || {})) {
  if (c.agent && !agents.has(c.agent)) bad('/' + n + ' -> missing agent ' + c.agent);
  else console.log('OK   /' + n.padEnd(14) + '-> ' + (c.agent || '(runs on the current agent)'));
}

// --- 5. config-level model refs and the ollama model list
console.log('\n-- config --');
for (const id of Object.keys(cfg.provider.ollama.models))
  if (!local.has(id)) bad('config lists unpulled ollama model: ' + id);
console.log('OK   all ' + Object.keys(cfg.provider.ollama.models).length + ' configured ollama models are pulled');
for (const [k, v] of Object.entries({ model: cfg.model, small_model: cfg.small_model })) {
  const i = v.indexOf('/'), p = v.slice(0, i), id = v.slice(i + 1);
  const ok = p === 'ollama' ? local.has(id) : !!(md[p] && md[p].models[id]);
  if (!ok) bad(k + ' -> ' + v + ' does not resolve');
  else console.log('OK   ' + k.padEnd(14) + '= ' + v);
}

// --- 6. no validator shares a model family with any implementer
console.log('\n-- cross-model validation --');
const fam = m => {
  if (m.startsWith('ollama/')) return 'local:' + m.split('/')[1].split(':')[0];
  if (/^(moonshotai|kimi-for-coding)\//.test(m)) return 'kimi';
  // openrouter is a BROKER, not a family. The vendor is the next path segment,
  // so openrouter/minimax/... and openrouter/z-ai/... are genuinely different
  // models and may validate each other.
  if (m.startsWith('openrouter/')) return m.split('/')[1];
  if (m.startsWith('opencode/')) {
    const id = m.split('/')[1];
    return (id.match(/^(big-pickle|minimax|nemotron|glm|kimi|deepseek|grok|ling|mimo|longcat)/) || [id])[0];
  }
  return m.split('/')[0];
};
const impl = ['local-quick', 'local-coder', 'local-reasoner', 'free-coder', 'free-thinker',
  'free-analyst', 'doc-writer', 'coder', 'speed-coder', 'python-dev', 'dotnet-dev',
  'deep-thinker', 'architect', 'cloud-architect'];
const vals = ['free-validator', 'local-validator', 'reviewer', 'validator', 'security-reviewer'];
for (const a of [...impl, ...vals]) console.log('     ' + a.padEnd(19) + fam(pin(a)));
for (const v of vals) for (const i of impl)
  if (fam(pin(v)) === fam(pin(i))) bad(v + ' shares family "' + fam(pin(v)) + '" with ' + i);
console.log(fail ? '' : 'OK   no validator shares a family with any implementer');

// --- 7. the ctx-estimate tier table must not drift from the agent pins
console.log('\n-- ctx-estimate tier table --');
{
  const src = fs.readFileSync('scripts/ctx-estimate.cjs', 'utf8');
  const table = src.slice(src.indexOf('const TIERS'), src.indexOf('];', src.indexOf('const TIERS')));
  for (const [, agent, model, ctx] of table.matchAll(/\['([a-z-]+)', '([^']+)', (\d+)\]/g)) {
    if (!agents.has(agent)) { bad('ctx-estimate lists unknown agent: ' + agent); continue; }
    const actual = pin(agent);
    if (model.includes('…')) { console.log('OK   ' + agent.padEnd(16) + ctx.padStart(9) + '  (label elided)'); continue; }
    if (actual !== model) bad('ctx-estimate says ' + agent + ' = ' + model + ', agents/ says ' + actual);
    else console.log('OK   ' + agent.padEnd(16) + ctx.padStart(9) + '  ' + model);
  }
}

// --- 8. every agent named in a router fallback chain exists
console.log('\n-- fallback chains --');
{
  const start = orch.indexOf('## Fallback chains');
  const chains = orch.slice(start, orch.indexOf('Rules:', start));
  const names = new Set([...chains.matchAll(/[a-z]+(?:-[a-z]+)+/g)].map(m => m[0])
    .filter(n => agents.has(n) || /^(free|local|pickle|deep|repo|doc|speed)-/.test(n)));
  for (const n of names) if (!agents.has(n)) bad('fallback chain names a missing agent: ' + n);
  console.log('OK   ' + names.size + ' agents referenced across the chains, all exist');
}

console.log('\n' + (fail ? fail + ' FAILURES' : 'ALL CHECKS PASSED'));
process.exit(fail ? 1 : 0);
