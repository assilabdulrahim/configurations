#!/usr/bin/env bash
# Outer loop: build -> evaluate -> rebuild, with stopping conditions.
#
# Structure follows the wrapper example in the anthropics/cwc-long-running-agents
# README, extended with the three stopping conditions that README calls for:
# a cycle budget, a no-progress detector, and a kill switch.
#
# UNTESTED. Read it before you run it unattended.

set -uo pipefail

MAX_CYCLES="${MAX_CYCLES:-20}"          # hard budget ceiling
MAX_NO_PROGRESS="${MAX_NO_PROGRESS:-3}" # consecutive cycles with no new commit
CONTRACT="test-results.json"

cycle=0
no_progress=0
last_head=""

# --- preflight -------------------------------------------------------------
for f in OBJECTIVE.md BUILD_PLAN.md SCOPE.lock "$CONTRACT"; do
  [ -f "$f" ] || { echo "MISSING: $f — run the planner first."; exit 1; }
done
rm -f AGENT_STOP

# --- loop ------------------------------------------------------------------
while grep -q '"passes": *false' "$CONTRACT"; do

  cycle=$((cycle + 1))

  if [ -f AGENT_STOP ]; then
    echo "STOP: operator kill switch."; break
  fi

  if [ "$cycle" -gt "$MAX_CYCLES" ]; then
    echo "STOP: cycle budget ($MAX_CYCLES) exhausted."; break
  fi

  echo "=== cycle $cycle ==="
  last_head=$(git rev-parse HEAD 2>/dev/null || echo "none")

  # --- build -------------------------------------------------------------
  if [ -f NEXT_FINDINGS.md ]; then
    PROMPT="The evaluator rejected the last attempt. Read NEXT_FINDINGS.md and fix exactly those findings. Follow CLAUDE.md."
  else
    PROMPT="Read PROGRESS.md and BUILD_PLAN.md, then build the next unfinished feature. Follow CLAUDE.md."
  fi

  claude -p "$PROMPT"

  # --- no-progress detector ----------------------------------------------
  new_head=$(git rev-parse HEAD 2>/dev/null || echo "none")
  if [ "$new_head" = "$last_head" ]; then
    no_progress=$((no_progress + 1))
    echo "WARN: no commit this cycle ($no_progress/$MAX_NO_PROGRESS)"
    if [ "$no_progress" -ge "$MAX_NO_PROGRESS" ]; then
      echo "STOP: no progress for $MAX_NO_PROGRESS consecutive cycles."; break
    fi
  else
    no_progress=0
  fi

  # --- evaluate ----------------------------------------------------------
  VERDICT=$(claude --agent evaluator -p "Review the most recent commit against BUILD_PLAN.md, SCOPE.lock and the done-conditions in OBJECTIVE.md.")

  if [ "$(echo "$VERDICT" | head -1 | tr -d '[:space:]')" = "PASS" ]; then
    rm -f NEXT_FINDINGS.md
    # Wrapper writes the contract, not the builder. Adapt the feature id
    # extraction to however you tag commits.
    FEATURE=$(git log -1 --pretty=%s | grep -oE 'feature-[0-9]+' | head -1)
    if [ -n "$FEATURE" ]; then
      tmp=$(mktemp)
      jq --arg f "$FEATURE" '.[$f].passes = true' "$CONTRACT" > "$tmp" && mv "$tmp" "$CONTRACT"
      echo "PASS: $FEATURE marked complete."
    else
      echo "PASS but no feature id in commit subject — contract not updated."
    fi
  else
    echo "$VERDICT" > NEXT_FINDINGS.md
    echo "NEEDS_WORK: findings written to NEXT_FINDINGS.md"
  fi

done

echo "=== loop ended after $cycle cycles ==="
grep -c '"passes": *true' "$CONTRACT" | xargs echo "features passing:"
