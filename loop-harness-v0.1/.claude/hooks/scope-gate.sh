#!/usr/bin/env bash
# PreToolUse hook. Two jobs:
#   1. The builder may never write test-results.json. Only the wrapper
#      writes it, and only on an evaluator PASS.
#   2. Warn loudly if a write targets a path on the OUT-of-scope list.
#
# NOTE: my implementation of the default-FAIL idea from the
# anthropics/cwc-long-running-agents README. Their shipped hook gates on
# evidence-reads instead; theirs is the reference, this is stricter and
# simpler. Read both.
#
# Reads the tool-call JSON on stdin. Adapt the jq paths to your Claude
# Code version before relying on this — I have not tested it against a
# live hook payload.

set -euo pipefail

INPUT=$(cat)
TARGET=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')

if [ -z "$TARGET" ]; then
  exit 0
fi

case "$TARGET" in
  *test-results.json)
    echo '{"decision":"deny","reason":"Builder may not write the contract file. Produce evidence and let the evaluator decide."}'
    exit 0
    ;;
  *SCOPE.lock|*OBJECTIVE.md)
    echo '{"decision":"deny","reason":"Scope artifacts are human/planner-owned. Propose changes in PROGRESS.md instead."}'
    exit 0
    ;;
esac

# Soft scope check against the OUT-of-scope list, if present.
if [ -f "OUT_OF_SCOPE.txt" ]; then
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    case "$TARGET" in
      $pattern)
        echo "{\"decision\":\"deny\",\"reason\":\"$TARGET matches an OUT-of-scope pattern ($pattern).\"}"
        exit 0
        ;;
    esac
  done < OUT_OF_SCOPE.txt
fi

exit 0
