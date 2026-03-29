# Roadmap: VIBE OS

## Overview

VIBE OS delivers a Tauri v2 desktop IDE where developers can see, direct, and audit every decision an AI coding agent makes. The build progresses from a validated foundation (Tauri shell + Tailwind v4 + SQLite WAL) through the visual shell, into the context assembly pipeline (skills, repos, prompt composer) that forms the product moat, then through subprocess management (Python REPL first to de-risk, then Claude CLI), and finally into visualization and polish. Each phase delivers a coherent, verifiable capability that builds on the previous.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Tauri v2 scaffold, Tailwind v4 CSS config, SQLite with WAL mode, shell plugin validation, production build proof
- [x] **Phase 2: Layout Shell** - Three-column resizable layout, custom title bar, status bar, shared components, dark theme, typography
- [x] **Phase 3: Context Assembly** - Repo manager, skills panel, prompt composer, prompt layer display, token budget bar
- [x] **Phase 4: Python REPL + Monaco Editor** - Python subprocess via shell plugin, console panel, Monaco editor with custom theme, file tabs, save-to-disk
- [x] **Phase 5: Agent Integration** - Claude CLI subprocess, event stream parser, chat panel with streaming, agent event display, working indicator
- [x] **Phase 6: Decisions, Audit & Scripts** - Micro-decision log, append-only audit trail, decision/audit export, scripts tracker, skills feedback loop
- [ ] **Phase 7: Visualization, Diff & Polish** - Architecture D3 graph, live preview panel, diff view with accept/reject, status bar live data, keyboard shortcuts

## Phase Details

### Phase 1: Foundation
**Goal**: A production-buildable Tauri v2 app with validated infrastructure -- Tailwind v4 CSS theme rendering correctly, SQLite database with WAL mode accepting writes, and shell plugin successfully spawning and killing a test subprocess
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-05, DB-01, DB-02
**Success Criteria** (what must be TRUE):
  1. `cargo tauri dev` launches a window with Tailwind v4-styled content (custom colors from the design system render correctly via `@theme {}` blocks, not tailwind.config.ts)
  2. `cargo tauri build` produces a distributable binary that launches without error
  3. SQLite database is created on first launch with WAL mode enabled, schema migrations run, and a test row can be written and read back
  4. A test subprocess can be spawned via Tauri shell plugin, its stdout read, and the process killed cleanly -- confirming permissions in capabilities/default.json are correct
  5. File paths resolve correctly via Tauri path API (appDataDir, not hardcoded paths)
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold Tauri v2 project, configure Tailwind v4 @theme, set up SQLite backend with WAL mode and migrations
- [x] 01-02-PLAN.md -- Shell plugin permissions, subprocess spawn/read/kill validation, production build proof

### Phase 2: Layout Shell
**Goal**: Users see a fully themed, three-column resizable IDE layout with custom title bar, status bar, tab strips, and reusable shared components -- all panels present as labeled placeholders ready to receive content
**Depends on**: Phase 1
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05, LAYOUT-06, LAYOUT-07, LAYOUT-08
**Success Criteria** (what must be TRUE):
  1. Three-column layout renders at default proportions (22%/40%/38%) with enforced minimum widths, and columns resize smoothly via drag handles without jank (using react-resizable-panels or allotment, not custom implementation)
  2. Each column displays a tab strip that switches between placeholder panels, and every panel has a consistent PanelHeader with title, icon, and action button slots
  3. Custom title bar displays "VIBE OS" branding and is draggable on the current OS; minimize/maximize/close buttons work
  4. Status bar renders at the bottom with placeholder slots for Python status, Claude status, session time, decision count, and action count
  5. Dark theme applies globally: background colors, text colors, accent colors all match the specified hex palette; Instrument Sans (UI), JetBrains Mono (code), and Space Mono (branding) fonts load correctly
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Install dependencies, configure custom title bar, build shared components (Badge/Dot/IconButton/Tooltip), layout components (PanelHeader/TabStrip/TitleBar/StatusBar), bundle fonts
- [x] 02-02-PLAN.md -- Three-column resizable layout with nested vertical splits, tab strips wired to placeholder panels, App.tsx integration

### Phase 3: Context Assembly
**Goal**: Users can activate repos and skills via checkboxes, see their composed prompt update in real time, and monitor token usage against a visual budget -- the full context pipeline from raw inputs to debuggable prompt output
**Depends on**: Phase 1, Phase 2
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05, CTX-06, CTX-07, CTX-08, CTX-09, CTX-10, CTX-11, DB-03, DB-04
**Success Criteria** (what must be TRUE):
  1. User can add a repo by pasting a git URL, see it appear in the repo manager with org label, branch name, file count, and language badge, and toggle it ON via checkbox to trigger file indexing
  2. Skills panel discovers and displays .md files from ~/.vibe-os/skills/ and project-local {repo}/.vibe/skills/ with category badges, token counts, and checkbox toggles
  3. Token budget bar shows total loaded skill tokens vs 20k soft limit, changing color at thresholds (accent/orange/red)
  4. Prompt Layer panel shows the composed prompt across System/Task/Repo sub-tabs in monospace readonly textareas, updating deterministically when repos or skills are toggled; "Copy Full Prompt" copies to clipboard
  5. System prompt tab is editable and persists to SQLite; session management (create, end, get active) works with linked repos, skills, and system prompt
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- Backend infrastructure: install dependencies, SQLite schema v2, Rust commands (session CRUD, skill discovery, repo management, prompt composition), Zustand store with 4 slices + SQLite storage adapter
- [x] 03-02-PLAN.md -- RepoManager panel with checkbox rows + AddRepoModal, SkillsPanel with checkbox rows + token budget bar, wire into MainLayout
- [x] 03-03-PLAN.md -- PromptLayer panel with sub-tabs + clipboard copy, app-level initialization (session/repos/skills on launch), complete left column wiring

### Phase 4: Python REPL + Monaco Editor
**Goal**: Users can write Python code in a themed Monaco editor and run it in an integrated REPL console -- validating the subprocess management pattern that Claude CLI integration will reuse in Phase 5
**Depends on**: Phase 1, Phase 2
**Requirements**: CONSOLE-01, CONSOLE-02, CONSOLE-03, EDIT-01, EDIT-02, EDIT-03, PLAT-04
**Success Criteria** (what must be TRUE):
  1. Python console spawns a Python subprocess, accepts user input, and displays output (cyan input, white output, red errors, dim system messages) with command history via up/down arrows
  2. Monaco editor opens Python files with syntax highlighting using a custom VIBE OS dark theme that matches the design system
  3. File tabs allow opening multiple files with close buttons; closing a tab disposes the Monaco model (no memory leaks)
  4. User can save the current file to disk via Ctrl+S, and the save triggers an audit log entry
  5. Default skill .md files are bundled and copied to ~/.vibe-os/skills/ on first launch
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- Backend infrastructure (SQLite v3, file/audit commands, skill bundling) + Monaco editor with custom theme, multi-tab model management, Ctrl+S save, editor store slice
- [x] 04-02-PLAN.md -- Python REPL console with subprocess management, colored output, command history, auto-scroll, StatusBar integration

### Phase 5: Agent Integration
**Goal**: Users can chat with Claude Code CLI through a streaming interface and see every agent event -- thoughts, decisions, file changes, errors -- parsed and displayed in real time with typed, color-coded entries
**Depends on**: Phase 3, Phase 4
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06, AGENT-07, AGENT-08, EDIT-04
**Success Criteria** (what must be TRUE):
  1. Claude Code CLI is spawned as a child process via Tauri shell plugin with the composed prompt from Phase 3's prompt composer; stdout streams to the frontend in real time
  2. Chat panel displays user messages (right-aligned, accent-colored) and assistant responses (left-aligned, surfaceHi) with streaming text and syntax-highlighted code blocks
  3. "Working..." indicator with pulsing dot appears while Claude is processing and disappears when the response completes
  4. Agent event stream displays typed, color-coded events (Think, Decision, FileCreate, FileModify, TestRun, PreviewUpdate, Error) with timestamps, type icons, colored indicators, and optional badges; new events auto-scroll with fade-slide-in animation
  5. event_stream.rs parses Claude CLI stdout into structured AgentEvent objects with a raw-text fallback mode for unparseable output (graceful degradation, not crashes)
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md -- Backend infrastructure: tokio + DB migration v4 (decisions), event_stream.rs parser, claude_commands.rs (start/send/cancel), agentSlice, useClaudeStream hook, eventParser utility, typed Tauri wrappers
- [x] 05-02-PLAN.md -- ClaudeChat panel with streaming messages, working indicator, code blocks with send-to-editor, message input, wire into MainLayout left bottom
- [x] 05-03-PLAN.md -- AgentStream panel with typed icons, color-coded events, confidence/line/pass-fail badges, fade-slide-in animation, wire into MainLayout right column

### Phase 6: Decisions, Audit & Scripts
**Goal**: Every agent and human action is captured in an immutable audit trail, every agent decision is logged with rationale and confidence, and users can extract reusable skills from tracked scripts -- completing the trust and feedback loop that differentiates VIBE OS
**Depends on**: Phase 5
**Requirements**: DECIDE-01, DECIDE-02, DECIDE-03, AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, SCRIPT-01, SCRIPT-02, SCRIPT-03
**Success Criteria** (what must be TRUE):
  1. Micro-decision log displays every agent decision with timestamp, decision text, rationale, confidence (0-1), impact category (perf/accuracy/dx/security/architecture), and reversibility; decision cards expand inline with left border colored by impact category
  2. Append-only audit trail logs every action (file changes, prompt sends, skill toggles, repo activations, test runs, decisions, errors) with timestamp, color-coded action_type, detail, and actor (agent/user/system); entries are never deleted or modified
  3. Decision log supports export to JSON or CSV; audit trail supports export
  4. Scripts tracker catalogs scripts created during sessions; "Generate Skills" button parses tracked scripts and creates .md skill files that appear in the skills panel for future sessions
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md -- Backend infrastructure: dialog plugin, decision_commands (CRUD + export), script_commands (list + generate skill), enhanced audit_commands (session filter + export), decision persistence from claude events, DecisionSlice + AuditSlice, audit wiring in skill/repo toggles
- [x] 06-02-PLAN.md -- DecisionLog panel with expandable cards + impact coloring, AuditLog panel with dense color-coded table, ScriptsTracker panel with skill generation, wire all into MainLayout right column

### Phase 7: Visualization, Diff & Polish
**Goal**: Users can visualize their codebase as an interactive graph, preview running web apps, review agent-proposed file changes with accept/reject controls, and see live status indicators -- completing the full VIBE OS experience
**Depends on**: Phase 5, Phase 6
**Requirements**: VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05, EDIT-05
**Success Criteria** (what must be TRUE):
  1. Architecture viewer renders a D3 force-directed graph of active repos showing modules, classes, and import relationships; nodes are colored by repo, sized by importance, with hover tooltips; graph supports drag, zoom, and a "Rebuild" button
  2. Live preview panel embeds a webview pointed at a dev server URL with auto-refresh on file changes (debounced 500ms), browser chrome mockup (URL bar, Live dot, auto-refresh toggle)
  3. Diff view shows agent-proposed file changes with accept/reject controls; accepting applies the change to the editor, rejecting discards it
  4. Title bar shows live session status badge, active repo/skill counts, and total context tokens; status bar shows live Python status, Claude status, session elapsed time, decision count, and action count
  5. "Send to editor" action on code blocks in chat opens the code in the Monaco editor
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md -- Backend infrastructure: architecture_commands.rs (Python file analysis + graph), D3 install, diffSlice (accept/reject flow), previewSlice (URL + auto-refresh), openUntitledFile for send-to-editor, useKeyboardShortcuts hook, tauri.ts wrappers
- [x] 07-02-PLAN.md -- ArchViewer with D3 force graph (drag/zoom/rebuild/glow/tooltips), LivePreview with iframe + chrome mockup + auto-refresh, DiffView with Monaco diff editor + accept/reject + pending list, wire into MainLayout center column
- [ ] 07-03-PLAN.md -- StatusBar live data (Claude status, session timer, decision/action counts), TitleBar live data (session badge, repo/skill counts, context tokens), keyboard shortcuts in App.tsx, final cleanup

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete | 2026-03-28 |
| 2. Layout Shell | 2/2 | Complete | 2026-03-28 |
| 3. Context Assembly | 3/3 | Complete | 2026-03-28 |
| 4. Python REPL + Monaco Editor | 2/2 | Complete | 2026-03-29 |
| 5. Agent Integration | 3/3 | Complete | 2026-03-28 |
| 6. Decisions, Audit & Scripts | 2/2 | Complete | 2026-03-29 |
| 7. Visualization, Diff & Polish | 2/3 | In Progress | - |
