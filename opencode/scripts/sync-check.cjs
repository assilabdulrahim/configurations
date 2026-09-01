// Is the repo you edit the same as the config opencode actually loads?
//
//   node scripts/sync-check.cjs                 # compare against ~/.config/opencode
//   node scripts/sync-check.cjs --dest <path>   # or somewhere else
//   node scripts/sync-check.cjs --json
//   node scripts/sync-check.cjs --quiet          # print only the drift count
//
// This exists because the two directories drifted twice in one session, in
// both directions, and both times it was noticed by accident:
//
//   - config edits were made here and never deployed, so the running router
//     was still on the old routing while the repo said otherwise
//   - the running router then fixed four scripts in the deployed copy, which
//     this repo did not have; committing the repo as-is would have shipped
//     the stale versions and the next deploy would have reverted the fixes
//
// Neither direction announces itself. A deploy is a file copy, so the loser
// is simply overwritten. verify-config.cjs catches config that contradicts
// itself; this catches config that contradicts its own deployment.
//
// It reports, it does not copy. Which side is correct is a judgement about
// what you meant to do, and a script guessing wrong here silently destroys
// work - which is the failure it is supposed to prevent.

const fs = require('fs');
const path = require('path');
const os = require('os');

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const QUIET = argv.includes('--quiet');

// --dest is parsed strictly, because getting it wrong is the one failure this
// script must never have. `--dest` with no value, or followed by another
// flag, used to fall through to the default: under --quiet that printed 0 and
// exited 0 - an all-clear from a comparison that never ran. A tool whose job
// is catching silent drift cannot itself fail silently, so this exits 2.
let DEST = path.join(os.homedir(), '.config', 'opencode');
if (argv.includes('--dest')) {
  const v = argv[argv.indexOf('--dest') + 1];
  if (!v || v.startsWith('--')) {
    console.error('sync-check: --dest needs a directory path' +
      (v ? ', got the flag ' + v : ' and none was given'));
    process.exit(2);
  }
  DEST = v;
}
const SRC = path.join(__dirname, '..');

const log = (...a) => { if (!JSON_OUT && !QUIET) console.log(...a); };

// What actually gets deployed. Everything else in the repo - git metadata,
// editor state, fetched catalogs, the worktrees Claude Code owns - is either
// not copied or is expected to differ, and listing it as drift would train
// you to ignore this script's output.
const TRACKED = ['agents', 'scripts', 'skills'];
const TRACKED_FILES = ['opencode.jsonc', 'AGENTS.md', 'README.md'];
const SKIP_DIR = new Set(['.git', '.claude', 'node_modules', '.opencode']);
const SKIP_FILE = new Set(['models.json', 'tags.json', '.DS_Store']);

function walk(rel, base, acc) {
  const abs = path.join(base, rel);
  let st;
  try { st = fs.statSync(abs); } catch { return acc; }
  if (st.isDirectory()) {
    if (SKIP_DIR.has(path.basename(abs))) return acc;
    for (const e of fs.readdirSync(abs)) walk(path.join(rel, e), base, acc);
  } else if (st.isFile() && !SKIP_FILE.has(path.basename(abs))) {
    acc.add(rel.split(path.sep).join('/'));
  }
  return acc;
}

function inventory(base) {
  const acc = new Set();
  for (const d of TRACKED) walk(d, base, acc);
  for (const f of TRACKED_FILES) {
    if (fs.existsSync(path.join(base, f))) acc.add(f);
  }
  return acc;
}

// Compare bytes, not mtimes: a copy updates the timestamp whether or not the
// content changed, so mtime would report drift on every deploy.
function same(rel) {
  try {
    const a = fs.readFileSync(path.join(SRC, rel));
    const b = fs.readFileSync(path.join(DEST, rel));
    return a.equals(b);
  } catch { return false; }
}

if (!fs.existsSync(DEST)) {
  log('WARN  no deployed config at ' + DEST);
  log('      Nothing to compare. Pass --dest if it lives elsewhere.');
  if (QUIET) console.log(0);
  process.exitCode = 0;
  return;
}

const srcFiles = inventory(SRC);
const dstFiles = inventory(DEST);

const onlySrc = [...srcFiles].filter(f => !dstFiles.has(f)).sort();
const onlyDst = [...dstFiles].filter(f => !srcFiles.has(f)).sort();
const differ = [...srcFiles].filter(f => dstFiles.has(f) && !same(f)).sort();

log('-- config sync --');
log('   repo:     ' + SRC);
log('   deployed: ' + DEST);
log('');

const drift = onlySrc.length + onlyDst.length + differ.length;

if (QUIET) console.log(drift);

if (!drift) {
  log('OK   ' + srcFiles.size + ' files, repo and deployed config are identical');
} else {
  for (const f of onlySrc) log('DRIFT  repo only, never deployed   ' + f);
  for (const f of onlyDst) log('DRIFT  deployed only, not in repo  ' + f);
  for (const f of differ) log('DRIFT  contents differ             ' + f);
  log('');
  log(drift + ' file(s) out of sync. Decide which side is correct before you');
  log('deploy or commit - a deploy overwrites the deployed copy, and a commit');
  log('records the repo copy. Either can discard the other silently.');
}

// --quiet wins over --json: a consumer asking for a bare count should not
// have to care which other flags were passed.
if (JSON_OUT && !QUIET) {
  console.log(JSON.stringify({ src: SRC, dest: DEST, onlySrc, onlyDst, differ }, null, 2));
}

process.exitCode = drift ? 1 : 0;
