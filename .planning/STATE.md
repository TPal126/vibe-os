# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-28)

**Core value:** Developers can see, understand, and direct every decision an AI coding agent makes
**Current focus:** Phase 7 in progress: Visualization, Diff & Polish

## Current Position

Phase: 7 of 7 (Visualization, Diff & Polish)
Plan: 2 of 3 in current phase
Status: Plan 07-02 complete -- ArchViewer, LivePreview, DiffView panels built and wired
Last activity: 2026-03-29 -- Completed 07-02 (Visualization Panels)

Progress: [=========.] 90%

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: ~5.6m
- Total execution time: ~1.52 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 2/2 | ~40m | ~20m |
| 2. Layout Shell | 2/2 | ~5m | ~2.5m |
| 3. Context Assembly | 3/3 | ~11.4m | ~3.8m |
| 4. Python REPL + Monaco | 2/2 | ~9m 24s | ~4m 42s |
| 5. Agent Integration | 3/3 | ~8.5m | ~2.8m |
| 6. Decisions, Audit & Scripts | 2/2 | ~9m 14s | ~4m 37s |
| 7. Visualization, Diff & Polish | 2/3 | ~10m 18s | ~5m 9s |

**Recent Trend:**
- Last 5 plans: 05-01 (~5m), 05-02 (~2m), 06-01 (5m 53s), 07-01 (5m 12s), 07-02 (5m 6s)
- Trend: Backend infrastructure plans ~5m avg, panel creation ~5m avg

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
- [06-01]: SkillMeta tokens field is usize (not i64) -- matched generate_skill_from_script return type accordingly
- [06-01]: Used super::db_commands::DbState consistently instead of local type aliases in new command files
- [06-01]: Added both FILE_CREATE and FILECREATE formats to script query for agent event compatibility
- [06-01]: Decision auto-capture from agent stream uses 0.8 confidence and architecture category as defaults
- [06-02]: Unicode escape sequences for special characters (arrows, triangles, squares) to avoid encoding issues
- [06-02]: PlaceholderPanel retained for center column (preview/architecture); right column fully replaced
- [06-02]: ScriptsTracker uses local React state (not Zustand) since scripts are session-specific
- [07-01]: Regex-based Python analysis (not AST) for v1 -- sufficient for module/class/function/import extraction
- [07-01]: Edge resolution drops external imports (only connects modules within analyzed repos)
- [07-01]: acceptDiff writes to disk AND updates open editor model via updateFileContent
- [07-01]: useClaudeStream callback made async to support await on readFile for file_modify diffs
- [07-02]: D3 simulation uses deep-copied nodes/edges (SimNode/SimEdge) to avoid mutating original graph data
- [07-02]: Typed D3 generics for proper TypeScript support instead of any casts
- [07-02]: LivePreview uses key-based iframe remount for refresh (reliable cross-origin reload)
- [07-02]: DiffView uses hardcoded 'python' language for DiffEditor (sufficient for v1)
- [07-02]: PlaceholderPanel removed from center column entirely; component file retained

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3, MEDIUM risk]: Python AST extraction strategy (Rust vs Python subprocess) needs a design decision before repo indexing implementation
- [Phase 2]: Must verify react-resizable-panels vs allotment via quick comparison test at phase start

## Session Continuity

Last session: 2026-03-29
Stopped at: Completed 07-02-PLAN.md. Ready for 07-03 (Live status, title bar, send-to-editor, shortcuts, final wiring).
Resume file: None
