// One source of truth for model families, required by both verify-config.cjs
// and smoke-agents.cjs (which must keep working when the models.dev catalog
// is absent - this module is pure string mapping, no catalog needed).
// The names below are the ones agents/orchestrator.md §8 reasons about:
//   local:<model>, pickle, nemotron, muse, ling, kimi, deepseek, google, z-ai
// That list is not exhaustive and this function is not closed over it: an id
// matching no known prefix falls back to its own name (an unrecognised
// opencode/<id> becomes <id>, anything else becomes its provider segment).
// The fallback is deliberate - it keeps two distinct models from silently
// merging into one family - so a new model yields a new family name here
// before §8 has heard of it.
// openrouter is a BROKER, not a family: the vendor is the next path segment,
// so openrouter/minimax/... and openrouter/z-ai/... are genuinely different
// models and may validate each other.
function family(m) {
  if (m.startsWith('ollama/')) return 'local:' + m.split('/')[1].split(':')[0];
  if (/^(moonshotai|kimi-for-coding)\//.test(m)) return 'kimi';
  if (m.startsWith('openrouter/')) return m.split('/')[1];
  if (m.startsWith('opencode/')) {
    const id = m.split('/')[1];
    if (id === 'big-pickle') return 'pickle';
    // any other opencode id keeps its full name - a safe fallback that never
    // merges two distinct models into one family
    return (id.match(/^(nemotron|muse|ling)/) || [id])[0];
  }
  return m.split('/')[0];
}

module.exports = { family };
