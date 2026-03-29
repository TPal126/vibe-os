# Phase 12 Plan 01: Strip to Single-Project Chat Summary

**One-liner:** Full-width chat layout replacing 3-column IDE -- 222-line MainLayout collapsed to 11, TitleBar rewritten with editable project name and context badges, StatusBar removed from render tree.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite MainLayout to full-width chat | 3adac9c | src/components/layout/MainLayout.tsx |
| 2 | Rewrite TitleBar to compact project bar | 81c2491 | src/components/layout/TitleBar.tsx |
| 3 | Remove StatusBar from App render | db07d73 | src/App.tsx |

## What Changed

### Task 1: MainLayout.tsx (222 lines -> 11 lines)
- Removed all 16 component imports (RepoManager, SkillsPanel, TokenControlPanel, WorkspaceTree, SessionDashboard, AgentStream, DecisionLog, AuditLog, MermaidDiagram, TabStrip, PanelHeader, etc.)
- Removed react-resizable-panels (Group, Panel, Separator) 3-column layout
- Removed local helper components (VerticalSep, HorizontalSep)
- Removed all Zustand store usage (drawerOpen, toggleDrawer, tokenWarningCount)
- Kept ClaudeChat as sole content surface with flex-1 overflow-hidden
- Kept SecondaryDrawer as hidden overlay (position:fixed, translate-y-full when closed)

### Task 2: TitleBar.tsx (224 lines -> 101 lines)
- Removed CreateWorkspaceModal, session badges, workspace buttons (FolderOpen, FolderPlus, Folder)
- Removed Dot component, AlertCircle icon
- Removed all useMemo blocks (sessionInfo, sessionBudget, tokenBudgetDisplay)
- Removed openWorkspace, claudeSessions, tokenBudgets from store selectors
- Added editable project name input (local useState, not contenteditable)
- Added compact context badges: "{N} repos . {N} skills . {Nk} tokens"
- Added Settings gear icon placeholder (non-functional)
- Preserved data-tauri-drag-region on all non-interactive elements
- Preserved h-10 shrink-0 container sizing
- Preserved window controls (minimize, maximize, close) unchanged

### Task 3: App.tsx (2 lines removed)
- Removed StatusBar import
- Removed StatusBar JSX from render
- App now renders: TitleBar + MainLayout only

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- TypeScript: 3 pre-existing errors (all in unmodified files: ClaudeChat.tsx, agentSlice.test.ts) -- confirmed identical before and after changes
- Tests: 67/67 passing (43 vitest + 24 cargo test) -- all green
- No new warnings introduced

## Key Decisions

- **Local-only project name editing**: The editable input uses local useState, not wired to backend persistence. Phase 13 will add proper persistence. This avoids premature store/backend changes.
- **SecondaryDrawer preserved**: Despite removing all panel chrome, kept the SecondaryDrawer overlay because it's already position:fixed with zero visual impact when closed, and Phase 17 needs it.
- **StatusBar.tsx file preserved**: Only removed from render tree, not deleted. Component stays on disk for potential reuse.
- **Pre-existing TS errors not fixed**: 3 unused-variable warnings in ClaudeChat.tsx and agentSlice.test.ts are pre-existing and out of scope for this layout-only phase.

## Files Preserved (Not Modified)

All 14 panel components, 15 store slices, 8 lib files, 2+ test files, 4 shared components, all Rust backend, package.json, globals.css -- preserved exactly as documented in plan.

## Metrics

- Duration: ~2.5 minutes
- Tasks: 3/3 completed
- Files modified: 3
- Lines removed: ~335 (net reduction)
- Lines added: ~15 (net)
- Tests: 67/67 passing
