---
phase: 10-multi-session-token-control
plan: 03
subsystem: token-control
tags: [token-budget, sqlite, tauri-commands, zustand-slice, ui-panel]
dependency_graph:
  requires: [10-01]
  provides: [token_budgets table, token CRUD commands, TokenSlice, TokenControlPanel]
  affects: [compose_prompt, promptSlice.recompose, MainLayout tabs]
tech_stack:
  added: []
  patterns: [upsert with scope uniqueness, budget enforcement via soft truncation, warning threshold color coding]
key_files:
  created:
    - src-tauri/src/commands/token_commands.rs
    - src/stores/slices/tokenSlice.ts
    - src/components/panels/TokenControlPanel.tsx
  modified:
    - src-tauri/src/db.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/commands/context_commands.rs
    - src-tauri/src/lib.rs
    - src/lib/tauri.ts
    - src/lib/tokens.ts
    - src/stores/types.ts
    - src/stores/slices/promptSlice.ts
    - src/stores/index.ts
    - src/components/layout/MainLayout.tsx
decisions:
  - Upsert pattern for token budgets using UNIQUE index on (scope_type, scope_id)
  - Budget enforcement uses soft truncation with visible marker text
  - Warning threshold color progression: green (0-75%), orange (75-90%), red (90%+)
  - Tokens tab replaces Phase 9 placeholder; leftTabs moved inside component for dynamic badge
metrics:
  duration: 7min
  completed: 2026-03-29T03:17:00Z
---

# Phase 10 Plan 03: Token Control Backend + Frontend Summary

Token budget CRUD in Rust with SQLite migration v6, Zustand tokenSlice with DB hydration and recompose triggers, TokenControlPanel with session/skill/repo budget sections and color-coded warning bars, budget enforcement in compose_prompt via per-scope soft truncation.

## What Was Built

### Backend (Task 1)

**Migration v6** (`db.rs`): Created `token_budgets` table with CHECK constraint on `scope_type` (must be 'skill', 'repo', or 'session') and UNIQUE index on `(scope_type, scope_id)` ensuring one budget per scope.

**Token Commands** (`token_commands.rs`): Three Tauri commands following the established DbState/Mutex pattern:
- `set_token_budget`: Upsert -- checks for existing (scope_type, scope_id), updates if found, inserts with UUID if not
- `get_token_budgets`: Returns all budgets ordered by scope_type, scope_id
- `delete_token_budget`: Deletes by ID

**Budget-Aware Compose Prompt** (`context_commands.rs`): Extended `compose_prompt` with three optional parameters:
- `skill_budgets: Option<Vec<(String, usize)>>` -- per-skill path to max tokens mapping
- `repo_budgets: Option<Vec<(String, usize)>>` -- per-repo index to max tokens mapping
- `session_budget: Option<usize>` -- overall session cap
All use `(limit * 3.5)` for tokens-to-chars conversion and append `[... truncated to fit token budget]` marker when content exceeds limits.

### Frontend (Task 2)

**Tauri Wrappers** (`tauri.ts`): Added `TokenBudgetRaw` interface and three command wrappers (`setTokenBudget`, `getTokenBudgets`, `deleteTokenBudget`). Updated `composePrompt` to accept optional budget arrays.

**Store Types** (`types.ts`): Added `TokenBudget` and `TokenSlice` interfaces. Extended `AppState` to include `TokenSlice`.

**Token Slice** (`tokenSlice.ts`): Full CRUD implementation with:
- `loadTokenBudgets`: Hydrates from DB with snake_case to camelCase mapping
- `setTokenBudget`/`deleteTokenBudget`: Mutate DB, update local state, trigger recompose
- `getSkillBudget`/`getRepoBudget`/`getSessionBudget`: O(n) lookup getters

**Prompt Slice** (`promptSlice.ts`): Updated `recompose()` to read `tokenBudgets` from store, build skill/repo budget arrays by matching budget scopeIds to active skill/repo IDs, and pass to `composePrompt`.

**Token Helpers** (`tokens.ts`): Added `getUsageRatio`, `getWarningLevel`, `getWarningColors` functions with green/orange/red progression.

**TokenControlPanel** (`TokenControlPanel.tsx`): Full panel with:
- `SessionBudgetSection`: Editable input + usage bar for overall session limit
- `SkillBudgetRow`: Per-active-skill editable limit, token count, usage bar, delete
- `RepoBudgetRow`: Per-active-repo with estimated tokens from indexSummary length
- `BudgetInput`: 72px wide, right-aligned monospace, blur-to-save
- `UsageBar`: h-1.5 color-coded bar (green/orange/red) with ratio text
- Warning badge count in panel header

**MainLayout** (`MainLayout.tsx`): Replaced placeholder panel with live `TokenControlPanel`. Moved `leftTabs` inside component to support dynamic warning badge count on the Tokens tab. Tab ID changed from `token-control` to `tokens` for consistency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused PlaceholderPanel import**
- **Found during:** Task 2, Part H
- **Issue:** After replacing the placeholder with TokenControlPanel, the PlaceholderPanel import became unused, causing `tsc --noEmit` to fail with TS6133
- **Fix:** Removed the unused import
- **Files modified:** src/components/layout/MainLayout.tsx
- **Commit:** ddb5e20

**2. [Rule 3 - Blocking] Adapted to Plan 10-02 changes in tauri.ts**
- **Found during:** Task 2, Part A
- **Issue:** Plan 10-02 (running in parallel) had already modified tauri.ts with ClaudeSessionInfo types and updated Claude command signatures
- **Fix:** Preserved 10-02 changes and added TokenBudgetRaw alongside them
- **Files modified:** src/lib/tauri.ts
- **Commit:** ddb5e20

## Verification Results

1. `cargo check` in src-tauri/ -- PASSED (only pre-existing warning about unused ContentBlock field)
2. `npx tsc --noEmit` -- PASSED (zero errors)
3. Token Control tab visible in left column tab strip with Gauge icon
4. Budget CRUD commands registered and functional
5. Warning color thresholds: green (0-75%), orange (75-90%), red (90%+)
6. Budget enforcement truncates content with soft marker in compose_prompt
7. All existing callers work unchanged (Option::None path for new params)

## Self-Check: PASSED

All 14 files verified present. Both commits (e74317e, ddb5e20) verified in git log.
