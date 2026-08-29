const fs = require('fs');
const SP = process.argv[2] || process.env.TEMP || ".";
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
const cfg = JSON.parse(stripJsonc(fs.readFileSync('opencode.jsonc', 'utf8')));
console.log('OK   opencode.jsonc parses as JSONC');

const agents = new Set(fs.readdirSync('agents').filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')));
const orch = fs.readFileSync('agents/orchestrator.md', 'utf8');
const named = [...orch.split('  task:')[1].split('---')[0].matchAll(/^\s+"([a-z-]+)":\s*allow/gm)].map(m => m[1]);
for (const a of named) if (!agents.has(a)) { console.log('FAIL router may call missing agent: ' + a); fail++; }
console.log('OK   router allow-list: ' + named.length + ' agents, all exist');
for (const a of agents) if (a !== 'orchestrator' && !named.includes(a)) console.log('WARN unreachable: ' + a);

for (const [n, c] of Object.entries(cfg.command || {})) {
  if (c.agent && !agents.has(c.agent)) { console.log('FAIL /' + n + ' -> missing agent ' + c.agent); fail++; }
  else console.log('OK   command /' + n + ' -> ' + c.agent);
}

const md = require(SP + '/models.json');
const local = new Set(require(SP + '/tags.json').models.map(m => m.name));
for (const id of Object.keys(cfg.provider.ollama.models))
  if (!local.has(id)) { console.log('FAIL config lists unpulled ollama model: ' + id); fail++; }
console.log('OK   all ' + Object.keys(cfg.provider.ollama.models).length + ' configured ollama models are pulled');

for (const [k, v] of Object.entries({ model: cfg.model, small_model: cfg.small_model })) {
  const i = v.indexOf('/'), p = v.slice(0, i), id = v.slice(i + 1);
  const ok = p === 'ollama' ? local.has(id) : !!(md[p] && md[p].models[id]);
  if (!ok) { console.log('FAIL ' + k + ' -> ' + v + ' does not resolve'); fail++; }
  else console.log('OK   ' + k + ' = ' + v);
}

// implementer/validator family-collision check
const fam = m => m.startsWith('ollama/') ? 'local:' + m.split('/')[1].split(':')[0]
  : /^(moonshotai|kimi-for-coding)\//.test(m) ? 'kimi'
    : m.split('/')[0];
const pin = f => (fs.readFileSync('agents/' + f + '.md', 'utf8').match(/^model:\s*(\S+)/m) || [])[1];
const impl = ['local-quick', 'local-coder', 'local-reasoner', 'coder', 'speed-coder', 'python-dev', 'dotnet-dev', 'deep-thinker'];
const vals = ['local-validator', 'reviewer', 'validator'];
console.log('\nfamily map:');
for (const a of [...impl, ...vals]) console.log('  ' + a.padEnd(18) + fam(pin(a)));
for (const v of vals) for (const i of impl)
  if (fam(pin(v)) === fam(pin(i))) { console.log('FAIL ' + v + ' shares a family with ' + i + ' (' + fam(pin(v)) + ')'); fail++; }

console.log('\n' + (fail ? fail + ' FAILURES' : 'ALL CHECKS PASSED'));
process.exit(fail ? 1 : 0);
