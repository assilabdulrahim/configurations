---
description: Stage 3 — check external reality. Prior art, incumbents, standards, timing. Everything cited.
allowed-tools: Read, Write, Glob, Grep, WebSearch, WebFetch
disable-model-invocation: true
---

Run stage 3. Use the `researcher` agent.

## Preconditions

`REQUIREMENTS.md` and `CRITIQUE.md` must exist.

## Instruction to the researcher

Read `IDEA.md`, `REQUIREMENTS.md` and `CRITIQUE.md` — particularly the
critic's proposed answer to "why hasn't this been done". Your job includes
checking it.

Produce `LANDSCAPE.md` covering:

1. **Prior art** — search for the *problem*, not the proposed solution.
   People describe problems differently than they describe products.
2. **Incumbents** — who owns this space, what they charge, what they are bad
   at, whether they are actively developing or coasting
3. **The gap** — concretely: a segment, workflow, price point, integration or
   jurisdiction. "Better UX" is not a gap.
4. **Failed attempts** — more informative than the successes. Find them.
5. **Standards and compliance** — named documents with versions
6. **Build vs buy** — existing components that remove most of the work, with
   licences
7. **Timing** — what changed recently that makes this possible now. If
   nothing has, that is itself a finding.

## Evidence standard — this is the point of the stage

- Every factual claim carries a source: product, publisher, date, URL. There
  is no unsourced-but-probably-true category.
- Prefer primary sources — vendor docs, pricing pages, filings, standards
  bodies. Flag listicles and SEO comparison sites as unreliable when used.
- Date everything. Pricing and feature sets go stale fast.
- Never infer capability from marketing copy. If the docs do not confirm it,
  write "claimed, not verified".
- "I searched X, Y, Z and found nothing" is a legitimate result. Do not
  manufacture a landscape to fill space.
- **Never invent a URL, product name, statistic or citation.**

Mandatory sections: `What I could not verify` and `Search coverage` (the
queries run and what each returned, so the human can judge thoroughness and
repeat it). If the first is empty you were not rigorous — go back.

## Verdict

End with exactly one of:

    NO INCUMBENT   — nothing comparable found; state search coverage
    CROWDED        — mature incumbents; the gap must be specific to proceed
    OCCUPIED       — someone does exactly this, well; recommend kill or pivot
    UNCLEAR        — insufficient evidence; say what would resolve it

Give the verdict the evidence supports, including when it argues against
building.

## Then

    LANDSCAPE.md written — verdict: <verdict>
    Next: /loop-decide
