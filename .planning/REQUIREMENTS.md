# Requirements: VIBE OS

**Defined:** 2026-03-28
**Core Value:** Developers can see, understand, and direct every decision an AI coding agent makes

## v1 Requirements (Complete)

All v1 requirements delivered in Phases 1-7. Preserved for reference.

### Layout & Shell

- [x] **LAYOUT-01**: App displays a three-column resizable layout (left 22%, center 40%, right 38%) with minimum widths enforced
- [x] **LAYOUT-02**: Each column has a tab strip for switching between panels within that column
- [x] **LAYOUT-03**: All panels have a consistent PanelHeader with title, icon, and optional action buttons
- [x] **LAYOUT-04**: Custom title bar displays "VIBE OS" branding, session status badge, active repo/skill counts, and total context tokens
- [x] **LAYOUT-05**: Status bar displays Python status, Claude status, session elapsed time, decision count, and action count
- [x] **LAYOUT-06**: Full dark theme implemented with the specified color palette (bg through cyanDim)
- [x] **LAYOUT-07**: Typography uses Instrument Sans (UI), JetBrains Mono (code), and Space Mono (branding)
- [x] **LAYOUT-08**: Shared components (Badge, Dot with pulse animation, IconButton, Tooltip) are reusable across all panels

### Code Editor

- [x] **EDIT-01**: Monaco editor opens Python files with syntax highlighting and a custom VIBE OS theme
- [x] **EDIT-02**: File tabs allow opening multiple files with close buttons
- [x] **EDIT-03**: User can save files to disk via keyboard shortcut (Cmd/Ctrl+S), triggering an audit log entry
- [x] **EDIT-04**: Editor receives code from Claude chat via a "send to editor" action on code blocks
- [x] **EDIT-05**: Diff view shows agent-proposed file changes with accept/reject controls

### Context Management

- [x] **CTX-01**: Repo manager displays repos with checkbox activation, org label, branch name, file count, and language badge
- [x] **CTX-02**: Toggling a repo ON triggers file indexing (modules, functions, classes) and updates the prompt composer
- [x] **CTX-03**: User can add repos by pasting a git URL in a dialog
- [x] **CTX-04**: Skills panel displays .md skill files with checkbox toggles, category badges (data/ml/core/web/infra/viz), and token counts
- [x] **CTX-05**: Token budget bar shows total loaded skill tokens vs 20k soft limit with color thresholds (accent/orange/red)
- [x] **CTX-06**: Checked skills inject their content into the prompt via the prompt composer
- [x] **CTX-07**: Skills are discovered from ~/.vibe-os/skills/ and project-local {repo}/.vibe/skills/
- [x] **CTX-08**: Prompt Layer panel shows composed prompt in three sub-tabs (System, Task, Repo) with monospace readonly textarea
- [x] **CTX-09**: System prompt tab is editable and persists to SQLite
- [x] **CTX-10**: "Copy Full Prompt" button copies the entire composed prompt to clipboard
- [x] **CTX-11**: Prompt composer assembles system + task + skill + repo context deterministically

### AI Agent Integration

- [x] **AGENT-01**: Claude Code CLI is spawned as a child process via Tauri shell plugin with streaming stdout
- [x] **AGENT-02**: Chat panel shows user messages (right-aligned, accent) and assistant messages (left-aligned, surfaceHi) with streaming
- [x] **AGENT-03**: "Working..." indicator with pulsing dot displays while Claude is processing
- [x] **AGENT-04**: Code blocks within chat messages have syntax highlighting
- [x] **AGENT-05**: Agent event stream displays typed, color-coded events (Think, Decision, FileCreate, FileModify, TestRun, PreviewUpdate, Error) with timestamps
- [x] **AGENT-06**: Each event renders with type icon, colored indicator, content, and optional badges (confidence, pass/fail, line counts)
- [x] **AGENT-07**: Events auto-scroll to bottom with fade-slide-in animation on new entries
- [x] **AGENT-08**: Claude CLI stdout is parsed by event_stream.rs into structured AgentEvent objects with graceful fallback for unparseable output

### Decision & Audit

- [x] **DECIDE-01**: Micro-decision log captures every agent and human decision with: timestamp, decision text, rationale, confidence (0-1), impact category (perf/accuracy/dx/security/architecture), reversibility
- [x] **DECIDE-02**: Decision cards are expandable inline with left border colored by impact category
- [x] **DECIDE-03**: Decision log supports export to JSON or CSV
- [x] **AUDIT-01**: Append-only audit trail logs every action: file changes, prompt sends, skill toggles, repo activations, test runs, decisions, errors
- [x] **AUDIT-02**: Each audit entry has: timestamp, action_type (color-coded), detail, actor (agent/user/system)
- [x] **AUDIT-03**: Audit log is never deleted or modified -- append-only by design
- [x] **AUDIT-04**: Audit trail supports export

### Scripts & Skills Feedback Loop

- [x] **SCRIPT-01**: Scripts tracker catalogs scripts created during IDE sessions with name, description, and creation timestamp
- [x] **SCRIPT-02**: "Generate Skills" button parses tracked scripts to extract reusable patterns and creates .md skill files
- [x] **SCRIPT-03**: Generated skills appear in the skills panel and can be toggled on for future sessions

### Console

- [x] **CONSOLE-01**: Lightweight Python console spawns a Python subprocess for running and verifying scripts
- [x] **CONSOLE-02**: Console displays input (cyan), output (text), errors (red), and system messages (dim)
- [x] **CONSOLE-03**: Command history accessible via up/down arrow keys

### Visualization

- [x] **VIZ-01**: Architecture viewer renders a D3 force-directed graph of active repos showing modules, classes, and import relationships
- [x] **VIZ-02**: Nodes are colored by repo, sized by importance (incoming edges), with hover tooltips showing file path and function list
- [x] **VIZ-03**: Graph supports drag, zoom, and a "Rebuild" button to re-analyze after changes
- [x] **VIZ-04**: Live preview panel embeds a webview pointed at a dev server URL with auto-refresh on file changes (debounced 500ms)
- [x] **VIZ-05**: Preview panel has browser chrome mockup (URL bar, Live dot, auto-refresh toggle)

### Database & Persistence

- [x] **DB-01**: SQLite database stores sessions, decisions, audit log, and settings with WAL mode enabled
- [x] **DB-02**: Schema migrations run automatically on app startup
- [x] **DB-03**: Frontend Zustand store hydrates from SQLite on launch and writes through on user actions
- [x] **DB-04**: Session management: create, end, get active session with linked repos, skills, and system prompt

### Platform & Infrastructure

- [x] **PLAT-01**: App builds and runs on Windows, macOS, and Linux via Tauri v2
- [x] **PLAT-02**: Tauri shell plugin permissions properly scoped in capabilities/default.json for subprocess spawning
- [x] **PLAT-03**: File paths resolved via Tauri path API, never hardcoded
- [x] **PLAT-04**: Default skill .md files bundled and copied to ~/.vibe-os/skills/ on first launch
- [x] **PLAT-05**: All Tauri commands return Result<T, String> with frontend error handling

## v2 Requirements

Requirements for the "Workspace-First Vibe Coding Overhaul" milestone. Phases 8-11.

### Workspace System

- [ ] **WS-01**: Rust commands scaffold a new workspace directory with the standard structure: CLAUDE.md, docs/, repos/, skills/, data/, output/
- [ ] **WS-02**: New Workspace flow: user enters a name, app creates the scaffolded directory under ~/vibe-workspaces/{name}/ and opens it as the active workspace
- [ ] **WS-03**: Open Workspace flow: user picks an existing workspace directory, app loads it as the active workspace and reads its CLAUDE.md, repos, and skills
- [ ] **WS-04**: CLAUDE.md in the workspace root serves as the system prompt (replaces the editable textarea from v1); editing CLAUDE.md updates the system prompt live
- [ ] **WS-05**: Repos clone into workspace/repos/ via the existing repo manager; repo paths are workspace-relative
- [ ] **WS-06**: Skills in workspace/skills/ are discovered alongside global ~/.vibe-os/skills/, with workspace-local skills taking priority on name conflicts
- [ ] **WS-07**: Workspace file tree component displays the workspace directory contents with expand/collapse folders, file icons, and click-to-open behavior

### Layout Restructure

- [x] **LAYOUT-09**: Left column restructured: top area has Repos, Skills, and Token Control as tabs; bottom area has the Workspace File Tree
- [ ] **LAYOUT-10**: Center column restructured: top area (60-70%) is Claude Chat (the primary interaction surface); bottom area (30-40%) is the Session Dashboard
- [x] **LAYOUT-11**: Secondary panels (Editor, Console, Preview, Diff) are accessible via a toggleable drawer or overlay, not permanently visible in the main layout
- [ ] **LAYOUT-12**: Right column restructured: top area has Decisions panel as default with Agent Stream and Audit Log as clickable alternatives in the same space; bottom area has the Mermaid architecture diagram
- [x] **LAYOUT-13**: Scripts Tracker is absorbed into the workspace file tree (scripts shown in output/ directory) or accessible via the drawer with other secondary panels

### Chat Enhancements

- [x] **CHAT-01**: App supports multiple concurrent Claude Code sessions, each with its own subprocess, conversation history, and working state
- [x] **CHAT-02**: Session tabs or visual switcher in the chat area allows switching between active Claude sessions; active session is visually distinct
- [x] **CHAT-03**: When a non-active Claude session needs user input, a visual alert (badge, notification dot, or toast) appears on its session tab so the user notices without switching to it

### Session Dashboard

- [x] **DASH-01**: Session Dashboard panel renders below Claude Chat in the center column, showing at-a-glance session state
- [x] **DASH-02**: Dashboard displays the current goal or task description (editable, persists to session)
- [x] **DASH-03**: Dashboard shows a context summary: which repos are active, which skills are loaded, current token usage vs budget
- [x] **DASH-04**: Dashboard has an activity feed showing recent events: decisions made, files changed, current Claude action (thinking, writing, etc.)
- [x] **DASH-05**: Dashboard displays session stats: elapsed time, message count, tokens used/remaining, files modified count

### Architecture Visualization

- [x] **ARCH-01**: Mermaid.js renders architecture diagrams in the right column bottom area, replacing the D3 force-directed graph
- [x] **ARCH-02**: Architecture diagram is generated from codebase analysis of active repos, showing module relationships, key classes, and data flow
- [x] **ARCH-03**: D3 force graph component and its dependencies are removed or deprecated; ArchViewer is replaced by MermaidDiagram

### Token Control

- [ ] **TOKEN-01**: Token Control panel appears as a tab alongside Repos and Skills in the left column top area
- [ ] **TOKEN-02**: User can set fine-grained token budgets: per-skill limits, per-repo context limits, and an overall session token budget; exceeding limits shows warnings

### Bug Fixes

- [ ] **BUG-01**: Repo and skill checkbox toggle state persists correctly when navigating between tabs in the left column (no reset on tab switch)
- [ ] **BUG-02**: Claude CLI spawn handles "program not found" gracefully — shows actionable error message with install instructions instead of raw error, and validates CLI availability on workspace open

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Inline tab autocomplete | Copilot/Cursor territory, requires massive ML infrastructure |
| Custom AI model hosting | Claude Code CLI is the engine |
| Plugin/extension marketplace | Needs user base first |
| Real-time collaboration | Multiplies complexity without validating core value |
| Built-in Git GUI | Claude Code's git awareness is sufficient |
| Jupyter notebook interface | Different paradigm, creates UX confusion |
| Mobile or web deployment | Tauri desktop only |
| OAuth/authentication | Desktop app, no auth needed |
| Jira integration | Deferred to v3 |
| Multi-language AST analysis | Python-first for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v1 (Phases 1-7, Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | Phase 2 | Complete |
| LAYOUT-02 | Phase 2 | Complete |
| LAYOUT-03 | Phase 2 | Complete |
| LAYOUT-04 | Phase 2 | Complete |
| LAYOUT-05 | Phase 2 | Complete |
| LAYOUT-06 | Phase 2 | Complete |
| LAYOUT-07 | Phase 2 | Complete |
| LAYOUT-08 | Phase 2 | Complete |
| EDIT-01 | Phase 4 | Complete |
| EDIT-02 | Phase 4 | Complete |
| EDIT-03 | Phase 4 | Complete |
| EDIT-04 | Phase 7 | Complete |
| EDIT-05 | Phase 7 | Complete |
| CTX-01 | Phase 3 | Complete |
| CTX-02 | Phase 3 | Complete |
| CTX-03 | Phase 3 | Complete |
| CTX-04 | Phase 3 | Complete |
| CTX-05 | Phase 3 | Complete |
| CTX-06 | Phase 3 | Complete |
| CTX-07 | Phase 3 | Complete |
| CTX-08 | Phase 3 | Complete |
| CTX-09 | Phase 3 | Complete |
| CTX-10 | Phase 3 | Complete |
| CTX-11 | Phase 3 | Complete |
| AGENT-01 | Phase 5 | Complete |
| AGENT-02 | Phase 5 | Complete |
| AGENT-03 | Phase 5 | Complete |
| AGENT-04 | Phase 5 | Complete |
| AGENT-05 | Phase 5 | Complete |
| AGENT-06 | Phase 5 | Complete |
| AGENT-07 | Phase 5 | Complete |
| AGENT-08 | Phase 5 | Complete |
| DECIDE-01 | Phase 6 | Complete |
| DECIDE-02 | Phase 6 | Complete |
| DECIDE-03 | Phase 6 | Complete |
| AUDIT-01 | Phase 6 | Complete |
| AUDIT-02 | Phase 6 | Complete |
| AUDIT-03 | Phase 6 | Complete |
| AUDIT-04 | Phase 6 | Complete |
| SCRIPT-01 | Phase 6 | Complete |
| SCRIPT-02 | Phase 6 | Complete |
| SCRIPT-03 | Phase 6 | Complete |
| CONSOLE-01 | Phase 4 | Complete |
| CONSOLE-02 | Phase 4 | Complete |
| CONSOLE-03 | Phase 4 | Complete |
| VIZ-01 | Phase 7 | Complete |
| VIZ-02 | Phase 7 | Complete |
| VIZ-03 | Phase 7 | Complete |
| VIZ-04 | Phase 7 | Complete |
| VIZ-05 | Phase 7 | Complete |
| DB-01 | Phase 1 | Complete |
| DB-02 | Phase 1 | Complete |
| DB-03 | Phase 3 | Complete |
| DB-04 | Phase 3 | Complete |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| PLAT-04 | Phase 4 | Complete |
| PLAT-05 | Phase 1 | Complete |

### v2 (Phases 8-11, Active)

| Requirement | Phase | Status |
|-------------|-------|--------|
| WS-01 | Phase 8 | In Progress (backend: 08-01) |
| WS-02 | Phase 8 | In Progress (frontend: 08-02, needs UI: 08-03) |
| WS-03 | Phase 8 | In Progress (frontend: 08-02, needs UI: 08-03) |
| WS-04 | Phase 8 | In Progress (watcher: 08-01+08-02, needs UI: 08-03) |
| WS-05 | Phase 8 | In Progress (backend+frontend: 08-01+08-02, needs UI: 08-03) |
| WS-06 | Phase 8 | In Progress (backend+frontend: 08-01+08-02, needs UI: 08-03) |
| WS-07 | Phase 8 | Pending |
| LAYOUT-09 | Phase 9 | Complete (09-01) |
| LAYOUT-10 | Phase 9 | In Progress (layout: 09-01, dashboard content: 09-02) |
| LAYOUT-11 | Phase 9 | Complete (09-01) |
| LAYOUT-12 | Phase 9 | In Progress (layout: 09-01, mermaid content: 09-03) |
| LAYOUT-13 | Phase 9 | Complete (09-01) |
| DASH-01 | Phase 9 | Complete (09-02) |
| DASH-02 | Phase 9 | Complete (09-02) |
| DASH-03 | Phase 9 | Complete (09-02) |
| DASH-04 | Phase 9 | Complete (09-02) |
| DASH-05 | Phase 9 | Complete (09-02) |
| ARCH-01 | Phase 9 | Complete (09-03) |
| ARCH-02 | Phase 9 | Complete (09-03) |
| ARCH-03 | Phase 9 | Complete (09-03) |
| CHAT-01 | Phase 10 | Complete (10-01, 10-02) |
| CHAT-02 | Phase 10 | Complete (10-02) |
| CHAT-03 | Phase 10 | Complete (10-02) |
| TOKEN-01 | Phase 10 | Pending |
| TOKEN-02 | Phase 10 | Pending |
| BUG-01 | Phase 11 | Pending |
| BUG-02 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 59 total (all complete)
- v2 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*v2 requirements added: 2026-03-28*
