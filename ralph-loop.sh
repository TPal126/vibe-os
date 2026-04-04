#!/usr/bin/env bash
set -uo pipefail

PLAN_FILE="RALPH-PLAN.md"
MAX_ITERATIONS=20
SLEEP_BETWEEN=5
LOG_FILE="ralph-loop.log"

echo "=== Ralph Wiggum Loop ==="
echo "Plan: $PLAN_FILE | Max: $MAX_ITERATIONS | Log: $LOG_FILE"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "--- Iteration $i / $MAX_ITERATIONS ---"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iteration $i" >> "$LOG_FILE"

  REMAINING=$(grep -c '^\- \[ \]' "$PLAN_FILE" 2>/dev/null || echo "0")
  COMPLETED=$(grep -c '^\- \[x\]' "$PLAN_FILE" 2>/dev/null || echo "0")
  echo "Tasks: $COMPLETED done, $REMAINING remaining"

  if [ "$REMAINING" -eq 0 ]; then
    echo "=== All tasks complete! ==="
    break
  fi

  PROMPT="Read RALPH-PLAN.md. Find the FIRST unchecked task (marked '- [ ]'). Implement ONLY that one task. After implementing: 1) Run 'npm run test' to verify no regressions. 2) Mark the task done by changing '- [ ]' to '- [x]' in RALPH-PLAN.md. 3) Commit all changes with a descriptive message. 4) If ALL tasks are now checked, output RALPH_DONE. 5) Exit. Follow existing patterns in CLAUDE.md. Do not ask questions."

  claude -p --dangerously-skip-permissions --verbose "$PROMPT" \
    2>&1 | tee -a "$LOG_FILE"

  EXIT_CODE=${PIPESTATUS[0]}

  if grep -q "RALPH_DONE" "$LOG_FILE"; then
    echo "=== Ralph signaled DONE ==="
    break
  fi

  if [ $EXIT_CODE -ne 0 ]; then
    echo "ERROR: exit code $EXIT_CODE"
  fi

  sleep $SLEEP_BETWEEN
done

echo ""
echo "=== Summary ==="
echo "Done: $(grep -c '^\- \[x\]' "$PLAN_FILE" 2>/dev/null || echo 0)"
echo "Remaining: $(grep -c '^\- \[ \]' "$PLAN_FILE" 2>/dev/null || echo 0)"
echo "Iterations: $i / $MAX_ITERATIONS"
