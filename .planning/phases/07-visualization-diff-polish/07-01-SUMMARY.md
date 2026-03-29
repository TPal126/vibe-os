---
phase: 07-visualization-diff-polish
plan: 01
subsystem: visualization-diff-preview-backend
tags: [architecture, d3, diff, preview, keyboard-shortcuts, tauri-commands, zustand]
dependency_graph:
  requires: [04-01-editor-slice, 05-01-agent-events, 06-01-audit-commands]
  provides: [architecture-command, diff-slice, preview-slice, keyboard-shortcuts, arch-graph-types]
  affects: [07-02-panels, 07-03-status-wiring]
tech_stack:
  added: [d3, "@types/d3", regex]
  patterns: [regex-python-analysis, pending-diff-accept-reject, file-change-driven-refresh, global-keyboard-shortcuts]
key_files:
  created:
    - src-tauri/src/commands/architecture_commands.rs
    - src/stores/slices/diffSlice.ts
    - src/stores/slices/previewSlice.ts
    - src/hooks/useKeyboardShortcuts.ts
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - package.json
    - src/stores/types.ts
    - src/stores/slices/editorSlice.ts
    - src/stores/index.ts
    - src/lib/tauri.ts
    - src/hooks/useClaudeStream.ts
decisions:
  - "Regex-based Python analysis (not AST) for v1 -- sufficient for module/class/function/import extraction"
  - "Edge resolution drops external imports (only connects modules within analyzed repos)"
  - "acceptDiff writes to disk AND updates open editor model via updateFileContent"
  - "useClaudeStream callback made async to support await on readFile for file_modify diffs"
  - "Ctrl+R override prevents Tauri webview reload and focuses console input"
metrics:
  duration: "5m 12s"
  completed: 2026-03-29T00:59:33Z
---

# Phase 7 Plan 1: Backend Infrastructure for Visualization, Diff & Polish Summary

Rust architecture analysis command, D3 dependency, diff/preview Zustand slices, editor untitled-file support, keyboard shortcuts hook, and agent-to-diff event wiring.

## What Was Built

### Task 1: architecture_commands.rs with Python File Analysis

**architecture_commands.rs** -- Rust command for codebase visualization:
- `analyze_architecture(repo_paths: Vec<String>)` walks all .py files in given repos
- Extracts modules (from file paths), imports (regex), classes (regex), functions (regex)
- Returns `ArchGraph { nodes: Vec<ArchNode>, edges: Vec<ArchEdge> }`
- Nodes typed as "module" or "class" with repo_name, file_path, function_list
- Edges typed as "import" with resolution to known modules only (external imports dropped)
- Filters __pycache__, .venv, node_modules directories
- Dunder methods filtered from function lists except __init__

**Infrastructure:**
- Added `regex = "1"` to Cargo.toml dependencies
- Registered `architecture_commands` module in commands/mod.rs
- Registered `analyze_architecture` in lib.rs invoke_handler

### Task 2: D3 Install, diffSlice, previewSlice, editorSlice Updates

**D3.js** -- Installed d3@7.9.0 and @types/d3 for frontend graph rendering.

**diffSlice.ts** -- Zustand slice for diff management:
- `pendingDiffs: PendingDiff[]` tracks proposed file changes from agent
- `addPendingDiff` creates entry with crypto.randomUUID() and "pending" status
- `acceptDiff` writes file to disk, logs audit (best-effort), updates open editor if file is open, removes from pending
- `rejectDiff` logs audit (best-effort), removes from pending
- `setActiveDiff` sets which diff is displayed in the DiffView panel

**previewSlice.ts** -- Zustand slice for live preview:
- `previewUrl: string | null` for iframe target URL
- `autoRefresh: boolean` toggle (default true)
- Not persisted -- preview URL is session-specific

**editorSlice.ts** (enhanced):
- `lastSaveTimestamp: number` increments on each successful saveFile (for file-change-driven preview refresh)
- `openUntitledFile(content, language)` creates virtual files (untitled-1.py, untitled-2.ts, etc.) and opens in editor

**types.ts** -- New interfaces:
- `PendingDiff`, `DiffSlice`, `PreviewSlice` added
- `EditorSlice` extended with `lastSaveTimestamp` and `openUntitledFile`
- `AppState` extended with `& DiffSlice & PreviewSlice`

**index.ts** -- Both new slices imported and spread into store creator.

### Task 3: Tauri Command Wrapper and Keyboard Shortcuts

**tauri.ts** (enhanced):
- `ArchNode`, `ArchEdge`, `ArchGraph` TypeScript interfaces mirroring Rust structs
- `analyzeArchitecture(repoPaths: string[])` command wrapper returning typed ArchGraph

**useKeyboardShortcuts.ts** -- Global keyboard shortcut hook:
- Ctrl+R: Prevents browser/webview reload, focuses console input via `[data-console-input]` selector
- Ctrl+S handled by Monaco (not duplicated)
- Ctrl+Enter handled per-component (not global)

### Task 4: Agent File Events to Pending Diffs Wiring

**useClaudeStream.ts** (enhanced):
- Detects `file_modify` and `file_create` agent events after normal event processing
- For `file_modify`: reads original file content from disk via `commands.readFile()` (with catch fallback to empty string)
- For `file_create`: uses empty string as original content
- Creates pending diff entry via `useAppStore.getState().addPendingDiff()` (fresh state access pattern)
- Callback made async to support await on readFile
- Only creates diffs when both filePath and proposedContent are available

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `cargo check` passes with only pre-existing warning (block_type field in event_stream.rs)
- `npx tsc --noEmit` passes cleanly (zero errors)
- `npm ls d3` confirms d3@7.9.0 installed
- All new commands registered and type-checked

## Commits

| Hash | Message |
|------|---------|
| 42a07df | feat(07-01): add architecture_commands.rs for Python file analysis |
| fbc3f3c | feat(07-01): install D3, create diffSlice/previewSlice, update editorSlice |
| ef5b1d4 | feat(07-01): add analyzeArchitecture command wrapper and useKeyboardShortcuts hook |
| 393d5aa | feat(07-01): wire agent file_modify/file_create events to pendingDiffs |

## Self-Check: PASSED

- All 9 key files verified present on disk
- All 4 commit hashes verified in git log
