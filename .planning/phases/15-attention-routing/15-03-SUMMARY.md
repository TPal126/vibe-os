---
phase: "15"
plan: "03"
subsystem: attention-routing
tags: [notifications, os-native, tauri-plugin, attention]
dependency-graph:
  requires: [phase-15-01-attention-state, phase-15-02-attention-badge]
  provides: [os-notifications]
  affects: [App.tsx, Cargo.toml, lib.rs, capabilities]
tech-stack:
  added: [tauri-plugin-notification, "@tauri-apps/plugin-notification"]
  patterns: [dynamic-import, ref-based-dedup, single-arg-subscribe]
key-files:
  created: [src/hooks/useNotifications.ts]
  modified: [src-tauri/Cargo.toml, src-tauri/src/lib.rs, src-tauri/capabilities/default.json, package.json, src/App.tsx]
decisions:
  - Single-arg subscribe with ref-based previous state tracking (store lacks subscribeWithSelector)
  - Dynamic import for notification plugin to avoid crashes in test/non-Tauri environments
  - Deduplication via notifiedRef Set with cleanup when attention clears
metrics:
  duration: "5m 6s"
  completed: "2026-03-29"
  tasks: 4
  files: 6
---

# Phase 15 Plan 03: OS-Level Notifications Summary

OS notifications via tauri-plugin-notification, firing on needs-input and error attention transitions with ref-based deduplication.

## What Was Built

1. **Tauri notification plugin (Rust + frontend + capability)** -- Added `tauri-plugin-notification = "2"` to Cargo.toml, registered in lib.rs builder chain, added `notification:default` capability, installed `@tauri-apps/plugin-notification` frontend package.

2. **useNotifications hook** -- Subscribes to store via single-argument pattern, compares current attention items to previous snapshot using refs, fires OS notifications for new items, deduplicates via `notifiedRef` Set, cleans up when attention clears. Uses dynamic import for graceful fallback in non-Tauri environments.

3. **App.tsx integration** -- Mounted `useNotifications()` alongside existing hooks (useKeyboardShortcuts, useWorkspaceWatcher, useClaudeStream).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8337463 | Install tauri-plugin-notification (Rust + frontend + capability) |
| 2 | ede001c | Create useNotifications hook for OS-level attention alerts |
| 3 | 65f8db3 | Mount useNotifications hook in App.tsx |

## Verification Results

- 43/43 frontend tests pass (vitest)
- Cargo check passes (only pre-existing warnings in event_stream.rs)
- TypeScript compiles (only pre-existing unused-var warnings in ClaudeChat.tsx and agentSlice.test.ts)
- No notification-related errors

## Success Criteria

- [x] `tauri-plugin-notification` added to Cargo.toml, registered in lib.rs, capability added
- [x] `@tauri-apps/plugin-notification` installed in frontend
- [x] `useNotifications` hook fires OS notifications for input-needed and error events
- [x] Notifications deduplicated -- one per session per attention cycle (ref-based previous state tracking)
- [x] Graceful fallback when notification permission denied (try/catch + dynamic import)
- [x] All frontend tests pass (43/43)
- [x] Rust compiles clean (cargo check)

## Phase 15 Completion Status

All 3 plans in Phase 15 (Attention Routing) are now complete:
- Plan 01: Attention state capture + project card indicators
- Plan 02: Title bar attention badge + auto-scroll
- Plan 03: OS-level notifications (this plan)

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED

- All 5 created/modified files verified on disk
- All 3 task commits verified in git log
