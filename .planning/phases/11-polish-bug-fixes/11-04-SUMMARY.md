---
phase: 11-polish-bug-fixes
plan: 04
subsystem: layout-ui
tags: [status-bar, title-bar, workspace-display, multi-session-status, token-budget-display, path-utility]
dependency_graph:
  requires: [08-01, 10-01, 10-02, 10-03]
  provides: [toWorkspaceRelative utility, v2 status/title bar state]
  affects: [StatusBar, TitleBar]
tech_stack:
  added: []
  patterns: [multi-session aggregation with useMemo, workspace-relative path normalization, token budget color thresholds]
key_files:
  created:
    - src/lib/utils.ts
  modified:
    - src/components/layout/StatusBar.tsx
    - src/components/layout/TitleBar.tsx
decisions:
  - Session status aggregates all claudeSessions with priority: error > needs-input > working > idle
  - Token budget display in TitleBar uses session-global budget; falls back to raw totalTokens if no budget set
  - Workspace name truncates at 140px (StatusBar) and 180px (TitleBar) with tooltip for full path
metrics:
  duration: 4min
  completed: 2026-03-29T11:31:00Z
---

# Phase 11 Plan 04: Status Bar & Title Bar v2 Updates Summary

StatusBar and TitleBar updated to reflect v2 state: workspace name with truncation/tooltip, multi-session count with color-coded status aggregation, token budget display from TokenSlice with warning color thresholds, and toWorkspaceRelative path utility for workspace-scoped path display.

## What Was Built

### Task 1: StatusBar Updates

**Workspace Indicator**: Folder icon + active workspace name. Shows "No Workspace" in dim text when none active. Tooltip displays full workspace path. Name truncates at 140px with ellipsis.

**Multi-Session Claude Status**: Replaced single "Claude: working/idle" indicator with session aggregation from claudeSessions Map. Displays "N sessions (M working)" format with priority-based coloring:
- Green (#00e5a0): all sessions idle
- Accent: sessions actively working (with pulse animation)
- Orange: one or more sessions need input
- Red: one or more sessions have errors

Also bumped version display from v0.1.0 to v0.2.0 to reflect v2 milestone.

### Task 2: TitleBar Updates

**Workspace Name in Branding**: Displays "VIBE OS -- workspace-name" when a workspace is active. Falls back to "Agentic Development System" subtitle when no workspace open. Name truncates at 180px.

**Multi-Session Badge**: Replaced single Active/No Session badge with multi-session aggregation showing "N Active" count. Green dot when all healthy, orange with AlertCircle icon when any session needs input. Pulse animation when sessions are working.

**Token Budget Display**: When a session-level global budget exists in TokenSlice, shows "used / max tokens" with color thresholds based on the budget's warningThreshold ratio. Falls back to the existing simple token count when no session budget is configured. Colors: dim (under threshold), orange (at warning), red (at/over limit).

### Task 3: Workspace-Relative Path Utility

**toWorkspaceRelative()** (`src/lib/utils.ts`): Strips workspace root from absolute paths for display. Normalizes both forward and backslash separators for Windows compatibility. Returns "." for exact workspace root match. Falls back to original absolute path when file is outside workspace.

**Visual Consistency**: Both bars use Tailwind `truncate` class (overflow: hidden + text-overflow: ellipsis + white-space: nowrap) with `max-w-[]` constraints. Title bar preserves `data-tauri-drag-region` on all draggable elements. Status bar height unchanged at h-7.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. `npx vite build` -- PASSED (built in 37s, no errors in changed files)
2. Pre-existing tsc errors in ClaudeChat.tsx (duplicate block-scoped variables from Phase 10) -- NOT related to this plan, left as-is
3. All three components compile cleanly
4. Workspace name truncation applied with CSS text-overflow ellipsis
5. Token budget display respects warningThreshold from TokenSlice
6. Multi-session aggregation reads from claudeSessions Map

## Self-Check: PASSED

All 3 files verified present. All 3 commits (bf3217c, b08d8d1, 3255aec) verified in git log.
