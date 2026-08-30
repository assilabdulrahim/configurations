// Context sizing: measure a file set, then say which tiers can actually hold it.
//
//   node scripts/ctx-estimate.cjs src/ lib/foo.ts
//   node scripts/ctx-estimate.cjs --diff          # staged + unstaged changes
//   node scripts/ctx-estimate.cjs --repo          # whole repo, minus ignores
//
// The router guesses context from a static table. This measures it, so
// "will this fit in local-coder" stops being a vibe.
//
// The estimate is chars/CHARS_PER_TOKEN. That is a heuristic, not a
// tokenizer: expect +/-20% on source code, worse on minified or non-Latin
// text. It is deliberately pessimistic (see OVERHEAD) because the cost of
// underestimating - a truncated context and a silently wrong answer - is far
// higher than the cost of routing one tier up.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHARS_PER_TOKEN = 3.6;   // conservative for source code
const OVERHEAD = 1.35;         // system prompt, tool defs, reply headroom

// context windows must match agents/*.md - verify-config.cjs cross-checks them
const TIERS = [
  ['local-quick', 'ollama/qwen2.5-coder:7b', 32768],
  ['local-coder', 'ollama/qwen3:32b', 40960],
  ['local-validator', 'ollama/llama3.1:70b', 131072],
  ['local-reasoner', 'ollama/gemma4:26b', 262144],
  ['coder', 'kimi-for-coding/k3-256k', 262144],
  ['free-validator', 'ollama/llama3.1:70b', 131072],
  ['free-coder', 'opencode/big-pickle', 204800],
  ['free-thinker', 'opencode/nemotron-3-ultra-free', 1048576],
  ['free-analyst', 'opencode/muse-spark-1.2-contributor-free', 1048576],
  ['orchestrator', 'deepseek/deepseek-v4-pro', 1000000],
];

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'bin', 'obj',
  '.next', '.venv', 'venv', '__pycache__', 'coverage', '.turbo']);
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf',
  '.zip', '.gz', '.tar', '.exe', '.dll', '.so', '.dylib', '.woff', '.woff2', '.ttf',
  '.mp4', '.mp3', '.db', '.sqlite', '.lock']);

function walk(p, acc) {
  let st;
  try { st = fs.statSync(p); } catch { return acc; }
  if (st.isDirectory()) {
    if (SKIP_DIR.has(path.basename(p))) return acc;
    for (const e of fs.readdirSync(p)) walk(path.join(p, e), acc);
  } else if (st.isFile()) {
    if (SKIP_EXT.has(path.extname(p).toLowerCase())) return acc;
    if (st.size > 2 * 1024 * 1024) return acc;      // treat >2MB as generated
    acc.push({ path: p, bytes: st.size });
  }
  return acc;
}

const args = process.argv.slice(2);
let files = [];
let label;

if (args.includes('--diff')) {
  label = 'uncommitted changes';
  const git = cmd => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n').map(s => s.trim()).filter(Boolean);
  // --relative: git reports paths from the repo root otherwise, which do not
  // resolve when this is run from a subdirectory.
  // ls-files --others: a new, untracked file is part of the change set too.
  const names = [...git('git diff HEAD --name-only --relative'),
    ...git('git ls-files --others --exclude-standard')];
  files = [...new Set(names)].filter(f => fs.existsSync(f))
    .flatMap(f => fs.statSync(f).isDirectory() ? walk(f, []) : [{ path: f, bytes: fs.statSync(f).size }]);
} else if (args.includes('--repo') || args.length === 0) {
  label = 'whole repo';
  files = walk('.', []);
} else {
  label = args.join(' ');
  for (const a of args) walk(a, files);
}

if (!files.length) {
  console.log('No files matched. Nothing to size.');
  process.exit(0);
}

const bytes = files.reduce((a, f) => a + f.bytes, 0);
const tokens = Math.round((bytes / CHARS_PER_TOKEN) * OVERHEAD);

console.log('scope:  ' + label);
console.log('files:  ' + files.length);
console.log('bytes:  ' + bytes.toLocaleString());
console.log('tokens: ~' + tokens.toLocaleString() + '  (chars/' + CHARS_PER_TOKEN +
  ' x ' + OVERHEAD + ' overhead)');

console.log('\n-- which tiers hold this --');
for (const [agent, model, ctx] of TIERS.sort((a, b) => a[2] - b[2])) {
  const pct = Math.round((tokens / ctx) * 100);
  // under 60% is comfortable; 60-100% leaves no room for the reply or tool output
  const verdict = pct <= 60 ? 'FITS   ' : pct < 100 ? 'TIGHT  ' : 'TOO BIG';
  console.log('  ' + verdict + ' ' + agent.padEnd(16) + String(ctx).padStart(9) +
    '  ' + String(pct).padStart(4) + '% used   ' + model);
}

console.log('\n-- largest files --');
for (const f of files.sort((a, b) => b.bytes - a.bytes).slice(0, 10))
  console.log('  ' + String(Math.round(f.bytes / CHARS_PER_TOKEN * OVERHEAD)).padStart(8) +
    ' tok  ' + f.path);

const smallest = TIERS.filter(t => tokens / t[2] <= 0.6).sort((a, b) => a[2] - b[2])[0];
console.log('\n' + (smallest
  ? 'Smallest comfortable tier: ' + smallest[0] + ' (' + smallest[1] + ')'
  : 'Nothing holds this comfortably. Narrow the scope, or send free-analyst to' +
    ' summarise first and pass its findings on instead of the raw files.'));
