#!/usr/bin/env bash
# Ralph Wiggum Loop — Claude Code Integration Improvements
# Usage: bash ralph-loop.sh
#
# This loop invokes Claude Code repeatedly to work through RALPH-PLAN.md.
# Each invocation picks up the next unchecked task, implements it, commits, and exits.
# The loop continues until all tasks are done or max iterations are reached.

set -uo pipefail

PLAN_FILE="RALPH-PLAN.md"
MAX_ITERATIONS=40
SLEEP_BETWEEN=5
LOG_FILE="ralph-loop.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Ralph Wiggum Loop ===${NC}"
echo "Plan: $PLAN_FILE"
echo "Max iterations: $MAX_ITERATIONS"
echo "Log: $LOG_FILE"
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo -e "${YELLOW}--- Iteration $i / $MAX_ITERATIONS ---${NC}"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iteration $i" >> "$LOG_FILE"

  # Check if plan is complete
  REMAINING=$(grep -c '^\- \[ \]' "$PLAN_FILE" 2>/dev/null || echo "0")
  COMPLETED=$(grep -c '^\- \[x\]' "$PLAN_FILE" 2>/dev/null || echo "0")

  echo "Tasks: $COMPLETED completed, $REMAINING remaining"

  if [ "$REMAINING" -eq 0 ]; then
    echo -e "${GREEN}=== All tasks complete! ===${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALL DONE" >> "$LOG_FILE"
    break
  fi

  # Run Claude Code with the plan prompt
  PROMPT="Read RALPH-PLAN.md. Find the FIRST unchecked task (marked '- [ ]'). Implement ONLY that one task following the instructions exactly. After implementing: 1) Run 'npm run test' to verify no regressions. 2) Mark the task as done by changing '- [ ]' to '- [x]' in RALPH-PLAN.md. 3) Commit all changes (including the updated RALPH-PLAN.md) with a descriptive message. 4) If ALL tasks are now checked, output RALPH_DONE. 5) Exit — do not proceed to the next task. Follow existing patterns in CLAUDE.md. Do not ask questions — make reasonable decisions and document any assumptions in commit messages."

  claude -p --dangerously-skip-permissions --verbose "$PROMPT" \
    2>&1 | tee -a "$LOG_FILE"

  EXIT_CODE=${PIPESTATUS[0]}

  # Check if Claude signaled completion
  if grep -q "RALPH_DONE" "$LOG_FILE"; then
    echo -e "${GREEN}=== Ralph signaled DONE ===${NC}"
    break
  fi

  if [ $EXIT_CODE -ne 0 ]; then
    echo -e "${RED}Claude exited with code $EXIT_CODE${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: exit code $EXIT_CODE" >> "$LOG_FILE"
  fi

  echo "Sleeping ${SLEEP_BETWEEN}s before next iteration..."
  sleep $SLEEP_BETWEEN
done

echo ""
echo "=== Ralph Loop Summary ==="
FINAL_REMAINING=$(grep -c '^\- \[ \]' "$PLAN_FILE" 2>/dev/null || echo "0")
FINAL_COMPLETED=$(grep -c '^\- \[x\]' "$PLAN_FILE" 2>/dev/null || echo "0")
echo "Completed: $FINAL_COMPLETED"
echo "Remaining: $FINAL_REMAINING"
echo "Iterations used: $i / $MAX_ITERATIONS"
echo "Full log: $LOG_FILE"
