---
phase: 04-python-repl-monaco
plan: 02
subsystem: python-repl-console
tags: [python, repl, subprocess, console, shell-plugin, zustand]
dependency-graph:
  requires: [04-01]
  provides: [console-slice, python-subprocess-hook, console-component]
  affects: [05-agent-integration, center-column, status-bar]
tech-stack:
  added: []
  patterns: [subprocess-lifecycle-hook, stderr-classification, useAppStore-getState-callbacks]
key-files:
  created:
    - src/stores/slices/consoleSlice.ts
    - src/hooks/usePythonProcess.ts
    - src/components/center/Console.tsx
  modified:
    - src/stores/types.ts
    - src/stores/index.ts
    - src/components/layout/MainLayout.tsx
    - src/components/layout/StatusBar.tsx
decisions:
  - usePythonProcess uses useAppStore.getState() for all event callbacks to avoid stale closures (consistent with 03-03/04-01 pattern)
  - stderr classification uses regex to separate Python prompts (>>> ...) from actual errors (Traceback, Error:, File lines)
  - Console has its own toolbar (Restart/Clear) instead of using PanelHeader -- gives tighter integration with process lifecycle
  - Input field disabled when Python not running, with placeholder text indicating state
metrics:
  duration: 3m 38s
  completed: 2026-03-29T00:25:22Z
  tasks-completed: 2
  tasks-total: 2
  files-created: 3
  files-modified: 4
---

# Phase 4 Plan 02: Python REPL Console Summary

Console store slice with typed entries and command history, Python subprocess hook using Tauri shell plugin Command.create() with -u -i flags and stderr prompt classification, and a full REPL component with colored output wired into center column and StatusBar.

## What Was Built

### Console Store Slice (Task 1)
- **ConsoleEntry interface**: id, type (input/output/error/system), text, timestamp
- **ConsoleSlice**: entries array (max 1000, oldest trimmed), inputHistory with dedup, historyIndex for up/down navigation, pythonRunning boolean
- **Actions**: addEntry (auto-generates id/timestamp), pushHistory (dedup last), navigateHistory (bidirectional with clamping), setPythonRunning, clearEntries
- **Store integration**: ConsoleSlice spread into AppState union, not persisted (ephemeral console state)

### Python Subprocess Hook (Task 1)
- **usePythonProcess hook**: start/send/kill functions using Command.create() from @tauri-apps/plugin-shell
- **Platform detection**: run-python-win on Windows, run-python on others (matching capabilities/default.json scopes)
- **Stderr classification**: lines matching `^(>>>|...)\s?` classified as system (dim), lines with Traceback/Error:/File as error (red), all other stderr as error
- **stdin writes**: Always appends `\n` newline (per Python interactive mode requirement)
- **Lifecycle**: childRef tracks spawned process, kill on unmount prevents orphan processes
- **Stale closure avoidance**: All event handlers use useAppStore.getState() for fresh state reads

### Console Component + Wiring (Task 2)
- **Console.tsx**: Full REPL with output area (auto-scroll), input field with `>>>` prompt, toolbar (Restart/Clear)
- **Color coding**: input (text-v-cyan), output (text-v-text), errors (text-v-red), system (text-v-dim) matching VIBE OS palette
- **Command history**: ArrowUp/ArrowDown navigates through inputHistory via navigateHistory()
- **Auto-scroll**: useEffect on entries.length scrolls bottom sentinel into view
- **MainLayout**: Console replaces PlaceholderPanel in center column bottom panel
- **StatusBar**: pythonRunning drives green dot + "Python: running" or dim dot + "Python: idle"

## Files Created/Modified

**Created (3):**
- `src/stores/slices/consoleSlice.ts` -- Console state management (75 lines)
- `src/hooks/usePythonProcess.ts` -- Python subprocess lifecycle hook (93 lines)
- `src/components/center/Console.tsx` -- Python REPL component (133 lines)

**Modified (4):**
- `src/stores/types.ts` -- Added ConsoleEntry, ConsoleSlice interfaces, updated AppState union
- `src/stores/index.ts` -- Imported and spread createConsoleSlice
- `src/components/layout/MainLayout.tsx` -- Console component replaces placeholder, removed unused Terminal import
- `src/components/layout/StatusBar.tsx` -- Reads pythonRunning from store, drives green/dim status indicator

## Key Decisions

1. **useAppStore.getState() in event handlers** -- All subprocess event callbacks (stdout, stderr, close, error) use direct store access instead of closure-captured references, consistent with project convention established in 03-03 and 04-01
2. **Console owns its toolbar** -- Instead of wrapping with PanelHeader, Console has its own inline toolbar with Restart and Clear buttons, giving tighter integration with the subprocess lifecycle
3. **Input disabled when not running** -- Input field is disabled with placeholder "Python not running" when pythonRunning is false, preventing user confusion
4. **Removed unused Terminal import** -- Cleaning up MainLayout.tsx since Console component handles its own header

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS -- zero errors |
| consoleSlice.ts exists (>= 40 lines) | PASS (75 lines) |
| usePythonProcess.ts exists (>= 50 lines) | PASS (93 lines) |
| Console.tsx exists (>= 80 lines) | PASS (133 lines) |
| ConsoleSlice spread in store index.ts | PASS |
| Console replaces PlaceholderPanel in MainLayout | PASS |
| StatusBar reads pythonRunning from store | PASS |
| Command.create pattern used in hook | PASS |
| addEntry called in stdout/stderr/close/error handlers | PASS |

## Commits

| Hash | Message |
|------|---------|
| `71b42e7` | feat(04-02): console store slice and Python subprocess hook |
| `24c8f7b` | feat(04-02): Python REPL console with colored output, history, and StatusBar wiring |

## Self-Check: PASSED

All 3 created files verified present. Both commits (71b42e7, 24c8f7b) found in git log. Line counts meet minimums. TypeScript compilation passes.
