# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-28)

**Core value:** Developers can see, understand, and direct every decision an AI coding agent makes
**Current focus:** Phase 4: Python REPL + Monaco Editor

## Current Position

Phase: 4 of 7 (Python REPL + Monaco Editor)
Plan: 1 of 2 in current phase
Status: Executing -- plan 04-01 complete, 04-02 next
Last activity: 2026-03-29 -- Completed 04-01 (backend infrastructure + Monaco editor)

Progress: [======....] 57%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: ~8.5m
- Total execution time: ~1.04 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 2/2 | ~40m | ~20m |
| 2. Layout Shell | 2/2 | ~5m | ~2.5m |
| 3. Context Assembly | 3/3 | ~11.4m | ~3.8m |
| 4. Python REPL + Monaco | 1/2 | ~5m 46s | ~5m 46s |

**Recent Trend:**
- Last 5 plans: 03-01 (5m 30s), 03-02 (2m 24s), 03-03 (3m 25s), 04-01 (5m 46s)
- Trend: Pure frontend plans fast (~2.5m avg), backend+frontend moderate (~5.5m), mixed ~3m

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Python REPL before Claude CLI -- de-risks subprocess pattern with simpler tool first
- [Roadmap]: Phases 2 and 4 can partially parallelize (both depend only on Phase 1), but Phase 3 depends on both Phase 1 and 2
- [Roadmap]: Audit/Decision/Scripts grouped into Phase 6 after Agent Integration -- wiring requires agent events to exist first
- [01-01]: Removed path:default from capabilities -- not a valid Tauri v2 permission; path API always available
- [01-01]: Used std::sync::Mutex for DB state (not tokio) -- rusqlite Connection is !Send
- [01-01]: Database stored at appDataDir (Roaming on Windows) per Tauri defaults
- [01-02]: Windows echo requires cmd /C wrapper (builtin, not standalone binary)
- [01-02]: Shell scope validator uses .+ not \S+ to allow spaces in test strings
- [01-02]: Frontend Command.create() is the primary subprocess pattern for Phase 4/5
- [02-01]: CSS-only Tooltip chosen over @radix-ui -- no extra dependency for simple text tooltips
- [02-01]: data-tauri-drag-region on every non-interactive TitleBar child for full drag coverage
- [02-01]: Named exports (not default) for all shared/layout components
- [03-01]: JSON text columns for active_repos/active_skills instead of junction tables -- simpler for v1
- [03-01]: Deterministic repo IDs via path-based hashing, not random UUIDs -- session-linked IDs persist across restarts
- [03-01]: Zustand partialize persists only systemPrompt and activeSession -- repos/skills loaded fresh from backend
- [03-01]: Optimistic UI updates with rollback on error for repo/skill toggles
- [03-02]: Inline subcomponents (RepoRow, SkillRow) co-located with parent panel files
- [03-02]: overflow-hidden on panel wrapper so RepoManager/SkillsPanel manage own scrolling
- [03-03]: useShallow for PromptLayer store access -- prevents unnecessary re-renders on unrelated slice changes
- [03-03]: Local state + 500ms debounced sync for system prompt textarea -- avoids SQLite writes on every keystroke
- [03-03]: App init uses useAppStore.getState() for post-async state reads to avoid stale closures
- [04-01]: Monaco local bundling via loader.config({ monaco }) -- CDN fails in Tauri webview
- [04-01]: Ctrl+S uses useAppStore.getState().saveFile() to avoid stale closure in Monaco command handler
- [04-01]: EditorSlice not persisted -- open files are transient, loaded from disk on demand
- [04-01]: write_file audit logging is best-effort -- save succeeds even without active session

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 5, HIGH risk]: Claude CLI stdout format is the lowest-confidence area -- must verify --output-format or --json flag availability before building event_stream.rs
- [Phase 3, MEDIUM risk]: Python AST extraction strategy (Rust vs Python subprocess) needs a design decision before repo indexing implementation
- [Phase 2]: Must verify react-resizable-panels vs allotment via quick comparison test at phase start

## Session Continuity

Last session: 2026-03-29
Stopped at: Completed 04-01-PLAN.md. Ready to execute 04-02 (Python REPL + console).
Resume file: None
