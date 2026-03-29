# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-28)

**Core value:** Developers can see, understand, and direct every decision an AI coding agent makes
**Current focus:** Phase 5 complete, ready for Phase 6: Decisions, Audit & Scripts

## Current Position

Phase: 6 of 7 (Decisions, Audit & Scripts)
Plan: 0 of 2 in current phase (not yet planned)
Status: Phase 5 complete -- all plans executed
Last activity: 2026-03-28 -- Completed 05-03 (AgentStream panel)

Progress: [=======...] 71%

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: ~6.2m
- Total execution time: ~1.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 2/2 | ~40m | ~20m |
| 2. Layout Shell | 2/2 | ~5m | ~2.5m |
| 3. Context Assembly | 3/3 | ~11.4m | ~3.8m |
| 4. Python REPL + Monaco | 2/2 | ~9m 24s | ~4m 42s |
| 5. Agent Integration | 3/3 | ~8.5m | ~2.8m |

**Recent Trend:**
- Last 5 plans: 03-03 (3m 25s), 04-01 (5m 46s), 04-02 (3m 38s), 05-01 (~5m), 05-02 (~2m)
- Trend: Pure frontend plans fast (~2m avg), backend+frontend moderate (~5m), mixed ~3m

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
- [04-02]: usePythonProcess event handlers use useAppStore.getState() for fresh state reads (stale closure avoidance)
- [04-02]: Console component owns its toolbar (Restart/Clear) instead of PanelHeader wrapper
- [04-02]: stderr classification regex separates Python prompts (>>> ...) from actual errors (Traceback, Error:, File)
- [05-01]: Migration v4 for decisions table (not v3 -- audit_log already existed at v3)
- [05-01]: Per-message spawn with --conversation-id for multi-turn (no stdin management)
- [05-01]: Status events (working/done/cancelled) are separate JSON objects, not AgentEvent structs
- [05-02]: v-orange used instead of v-warning for system/error message styling (theme has v-orange, not v-warning)
- [05-03]: EVENT_CONFIG uses CSS variables (var(--color-v-green) etc.) for existing theme colors, hex for badge-specific colors

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3, MEDIUM risk]: Python AST extraction strategy (Rust vs Python subprocess) needs a design decision before repo indexing implementation
- [Phase 2]: Must verify react-resizable-panels vs allotment via quick comparison test at phase start

## Session Continuity

Last session: 2026-03-28
Stopped at: Completed 05-03-PLAN.md. Phase 5 complete. Ready for Phase 6 planning (Decisions, Audit & Scripts).
Resume file: None
