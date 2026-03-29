---
phase: 07-visualization-diff-polish
plan: 03
subsystem: live-status-wiring-shortcuts-polish
tags: [statusbar, titlebar, live-data, keyboard-shortcuts, send-to-editor, polish]
dependency_graph:
  requires: [07-01-agent-slice, 07-01-editor-slice, 07-02-center-column-wiring]
  provides: [live-statusbar, live-titlebar, keyboard-shortcuts, send-to-editor]
  affects: []
tech_stack:
  added: []
  patterns: [setInterval-timer, useShallow-selector, data-attribute-targeting, openUntitledFile-action]
key_files:
  created: []
  modified:
    - src/components/layout/StatusBar.tsx
    - src/components/layout/TitleBar.tsx
    - src/App.tsx
    - src/components/center/Console.tsx
    - src/components/panels/ClaudeChat.tsx
decisions:
  - "Claude status derived from isWorking + agentError (three states: idle/working/error)"
  - "Decision count from agentEvents filtered by event_type === 'decision'; action count from total agentEvents length"
  - "Session timer uses setInterval(1s) with cleanup on unmount/session change"
  - "Token count color thresholds: dim < 15k, orange 15-20k, red > 20k"
  - "data-console-input attribute used for keyboard shortcut targeting (Ctrl+R focuses console)"
  - "ClaudeChat code blocks get separate Copy and Open in Editor buttons (not combined)"
metrics:
  duration: "2m 58s"
  completed: 2026-03-29T01:15:39Z
---

# Phase 7 Plan 3: Live Status, Title Bar, Send-to-Editor, Shortcuts, Final Wiring Summary

Live StatusBar with Claude status/session timer/decision+action counts, live TitleBar with session badge/repo+skill counts/token display, keyboard shortcuts wired globally, and Open in Editor button on ClaudeChat code blocks.

## What Was Built

### Task 1: StatusBar Live Data Wiring

**StatusBar.tsx** -- fully live status bar with data from Zustand store:
- Python status: green "running" with pulsing dot when active, dim "idle" otherwise (existing behavior preserved + pulse added)
- Claude status: accent "working" with pulsing dot during agent calls, red "error" on failure, dim "idle" otherwise
- Session elapsed time: computed from `activeSession.startedAt` with 1-second `setInterval` timer, format `H:MM:SS`, resets to `0:00:00` when no session
- Decision count: filters `agentEvents` for `event_type === "decision"`, updates live
- Action count: total `agentEvents.length` as proxy for all agent activity
- `useShallow` on main selector to prevent unnecessary re-renders; separate selectors for derived counts

### Task 2: TitleBar Live Data Wiring

**TitleBar.tsx** -- live title bar with session and context info:
- Session badge: green pulsing "Active" when `activeSession` exists, dim "No Session" otherwise (replaces static "Ready" badge)
- Repo count badge: accent-colored, shows `{N} repo(s)` from `repos.filter(r => r.active).length`
- Skill count badge: cyan-colored, shows `{N} skill(s)` from `skills.filter(s => s.active).length`
- Token count badge: only shown when `totalTokens > 0`, color changes at thresholds (dim < 15k, orange 15-20k, red > 20k), formatted as `X.Xk tokens` for > 1000
- `data-tauri-drag-region` preserved on center wrapper for window dragging

### Task 3: Keyboard Shortcuts + Console Data Attribute + Cleanup

**App.tsx** -- imported and called `useKeyboardShortcuts()` at component top level:
- Ctrl+R now prevents browser reload and focuses console input globally
- Ctrl+S still handled by Monaco command system (no conflict)

**Console.tsx** -- added `data-console-input` attribute to the input element:
- Allows `useKeyboardShortcuts` to find and focus the console input via `document.querySelector("[data-console-input]")`

**PlaceholderPanel cleanup** -- verified no remaining usage:
- MainLayout imports no PlaceholderPanel (all 3 columns use real components)
- PlaceholderPanel.tsx file retained but unused (available if needed later)

### Task 4: Open in Editor Button on ClaudeChat Code Blocks

**ClaudeChat.tsx** -- wired `openUntitledFile` from editorSlice:
- Code blocks now have two buttons: "Copy" (clipboard) and "Open in Editor" (opens in Monaco)
- "Open in Editor" calls `openUntitledFile(block.code, block.language || "python")`
- Creates an untitled file in the editor with the code content and correct language
- Completes EDIT-04 requirement: "Editor receives code from Claude chat via a send-to-editor action on code blocks"
- Added `Copy` icon import from lucide-react for the clipboard button

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes cleanly (zero errors) after all 4 tasks
- StatusBar reads live data from agentSlice, consoleSlice, sessionSlice
- TitleBar reads live data from sessionSlice, repoSlice, skillSlice, promptSlice
- useKeyboardShortcuts called in App.tsx (global scope)
- Console input has data-console-input attribute for Ctrl+R targeting
- ClaudeChat code blocks have "Open in Editor" button calling openUntitledFile
- No PlaceholderPanel usage remains in MainLayout

## Commits

| Hash | Message |
|------|---------|
| 9f6f097 | feat(07-03): wire live data into StatusBar |
| 74d9927 | feat(07-03): wire live data into TitleBar |
| 32531cb | feat(07-03): wire keyboard shortcuts, add data-console-input attribute |
| 8adebe4 | feat(07-03): wire 'Open in Editor' button on ClaudeChat code blocks |

## Self-Check: PASSED

- All 5 modified files verified present on disk
- All 4 commit hashes verified in git log
