#!/usr/bin/env bash
# PreToolUse hook. Halts every tool call while AGENT_STOP exists at the
# project root. Operator control: `touch AGENT_STOP` to stop a run.
#
# NOTE: this is my implementation of the pattern described in the
# anthropics/cwc-long-running-agents README, not a copy of their file.
# Compare against theirs before relying on it.

set -euo pipefail

if [ -f "AGENT_STOP" ]; then
  echo '{"decision":"deny","reason":"AGENT_STOP present at project root. Operator halted the run."}'
  exit 0
fi

exit 0
