// Pre-commit gate: run the checks that are free, fast and offline-safe.
//
//   node opencode/scripts/gate.cjs          # what the hook runs
//   node opencode/scripts/gate.cjs --full   # + free-tier smoke (minutes, live calls)
//
// WHY THIS EXISTS. Four scripts here already exit non-zero on a real fault -
// verify-config (1), smoke-agents (1), sync-check (1), preflight (2) - and until
// now nothing ran them. The checks were written; the enforcement was not.
//
// WHAT IS DELIBERATELY NOT HERE, and why:
//
//   sync-check   asks "is the DEPLOYED copy current?". That is a deploy
//                question, not a commit question - you commit, then deploy, so a
//                hook that fails because you have not deployed yet is backwards.
//                Run it after deploying. (It also reports every file as drifted
//                while the deployed tree is LF and the repo is CRLF, which would
//                block every commit and get this hook bypassed permanently.)
//
//   smoke --paid calls every paid provider. A gate that spends money per commit
//                is a bug, not a safeguard. Reachable only by hand.
//
// THE CATALOG PROBLEM. verify-config needs models.json and tags.json, which come
// from the network and from the ollama box. A hook that requires either is one
// that fails on a plane and gets --no-verify'd forever, after which it protects
// nothing. So: use the catalogs when they are present and fresh, and SKIP with
// instructions when they are not. Skipping is not failing. The push-time
// expectation - that verify-config has passed - lives in the README and is kept
// by habit, which is the honest place for it.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');          // the opencode/ config dir
const FULL = process.argv.includes('--full');
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

let failed = 0;
const run = (label, args) => {
  process.stdout.write('gate: ' + label + ' ... ');
  try {
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('OK');
  } catch (e) {
    console.log('FAILED');
    // Print the tool's own FAILING lines, not its whole transcript. These
    // scripts narrate every passing check too, and a hook that prints a hundred
    // OK lines to report one FAIL is a hook you learn to scroll past - the same
    // way the compression instruction in orchestrator.md 4.5 quietly died.
    const out = String((e.stdout || '') + (e.stderr || ''));
    const all = out.split(/\r?\n/);
    const hits = all.filter(l => /FAIL|WARN|FAILURES|Error/.test(l));
    const shown = hits.length ? hits : all.filter(Boolean).slice(-5);
    for (const l of shown) console.log('  ' + l.trim());
    failed++;
  }
};

const fresh = f => {
  const p = path.join(ROOT, f);
  try { return Date.now() - fs.statSync(p).mtimeMs < MAX_AGE_MS; } catch { return false; }
};

if (fresh('models.json') && fresh('tags.json')) {
  run('verify-config', [path.join(ROOT, 'scripts', 'verify-config.cjs'), ROOT]);
} else {
  console.log('gate: verify-config ... SKIPPED (catalogs missing or >24h old)');
  console.log('  refresh, then commit again to include this check:');
  console.log('    curl -s https://models.dev/api.json         -o opencode/models.json');
  console.log('    curl -s http://192.168.86.24:11434/api/tags -o opencode/tags.json');
}

if (FULL) run('smoke-agents (free tier)', [path.join(ROOT, 'scripts', 'smoke-agents.cjs')]);

if (failed) {
  console.log('');
  console.log('gate: ' + failed + ' check(s) failed - commit blocked.');
  console.log('Fix, or bypass deliberately with: git commit --no-verify');
}
process.exitCode = failed ? 1 : 0;
