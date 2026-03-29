# Requirements: VIBE OS

**Defined:** 2026-03-28
**Core Value:** Developers can see, understand, and direct every decision an AI coding agent makes

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

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
- [ ] **EDIT-04**: Editor receives code from Claude chat via a "send to editor" action on code blocks
- [ ] **EDIT-05**: Diff view shows agent-proposed file changes with accept/reject controls

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

- [ ] **AGENT-01**: Claude Code CLI is spawned as a child process via Tauri shell plugin with streaming stdout
- [ ] **AGENT-02**: Chat panel shows user messages (right-aligned, accent) and assistant messages (left-aligned, surfaceHi) with streaming
- [ ] **AGENT-03**: "Working..." indicator with pulsing dot displays while Claude is processing
- [ ] **AGENT-04**: Code blocks within chat messages have syntax highlighting
- [ ] **AGENT-05**: Agent event stream displays typed, color-coded events (Think, Decision, FileCreate, FileModify, TestRun, PreviewUpdate, Error) with timestamps
- [ ] **AGENT-06**: Each event renders with type icon, colored indicator, content, and optional badges (confidence, pass/fail, line counts)
- [ ] **AGENT-07**: Events auto-scroll to bottom with fade-slide-in animation on new entries
- [ ] **AGENT-08**: Claude CLI stdout is parsed by event_stream.rs into structured AgentEvent objects with graceful fallback for unparseable output

### Decision & Audit

- [ ] **DECIDE-01**: Micro-decision log captures every agent and human decision with: timestamp, decision text, rationale, confidence (0-1), impact category (perf/accuracy/dx/security/architecture), reversibility
- [ ] **DECIDE-02**: Decision cards are expandable inline with left border colored by impact category
- [ ] **DECIDE-03**: Decision log supports export to JSON or CSV
- [ ] **AUDIT-01**: Append-only audit trail logs every action: file changes, prompt sends, skill toggles, repo activations, test runs, decisions, errors
- [ ] **AUDIT-02**: Each audit entry has: timestamp, action_type (color-coded), detail, actor (agent/user/system)
- [ ] **AUDIT-03**: Audit log is never deleted or modified — append-only by design
- [ ] **AUDIT-04**: Audit trail supports export

### Scripts & Skills Feedback Loop

- [ ] **SCRIPT-01**: Scripts tracker catalogs scripts created during IDE sessions with name, description, and creation timestamp
- [ ] **SCRIPT-02**: "Generate Skills" button parses tracked scripts to extract reusable patterns and creates .md skill files
- [ ] **SCRIPT-03**: Generated skills appear in the skills panel and can be toggled on for future sessions

### Console

- [ ] **CONSOLE-01**: Lightweight Python console spawns a Python subprocess for running and verifying scripts
- [ ] **CONSOLE-02**: Console displays input (cyan), output (text), errors (red), and system messages (dim)
- [ ] **CONSOLE-03**: Command history accessible via up/down arrow keys

### Visualization

- [ ] **VIZ-01**: Architecture viewer renders a D3 force-directed graph of active repos showing modules, classes, and import relationships
- [ ] **VIZ-02**: Nodes are colored by repo, sized by importance (incoming edges), with hover tooltips showing file path and function list
- [ ] **VIZ-03**: Graph supports drag, zoom, and a "Rebuild" button to re-analyze after changes
- [ ] **VIZ-04**: Live preview panel embeds a webview pointed at a dev server URL with auto-refresh on file changes (debounced 500ms)
- [ ] **VIZ-05**: Preview panel has browser chrome mockup (URL bar, Live dot, auto-refresh toggle)

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

Deferred to future release. Tracked but not in current roadmap.

### Integrations

- **INTEG-01**: Jira integration — configure, fetch sprint tickets, update status, link to sessions
- **INTEG-02**: Jira panel with sprint/mine/linked filters and ticket detail modals
- **INTEG-03**: Agent Jira events trigger actual Jira API calls

### Enhanced Editor

- **EDIT-06**: Multi-language AST analysis (beyond Python)
- **EDIT-07**: Inline code actions from architecture graph nodes

### Advanced Skills

- **SKILL-01**: Skills marketplace — discover and install community skills
- **SKILL-02**: Skills versioning and dependency tracking

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Inline tab autocomplete | Copilot/Cursor territory, requires massive ML infrastructure |
| Custom AI model hosting | Claude Code CLI is the v1 engine |
| Plugin/extension marketplace | Needs user base first |
| Real-time collaboration | Multiplies complexity without validating core value |
| Built-in Git GUI | Claude Code's git awareness is sufficient |
| Jupyter notebook interface | Different paradigm, creates UX confusion |
| Mobile or web deployment | Tauri desktop only |
| OAuth/authentication | Desktop app, no auth needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

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
| EDIT-04 | Phase 5 | Pending |
| EDIT-05 | Phase 7 | Pending |
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
| AGENT-01 | Phase 5 | Pending |
| AGENT-02 | Phase 5 | Pending |
| AGENT-03 | Phase 5 | Pending |
| AGENT-04 | Phase 5 | Pending |
| AGENT-05 | Phase 5 | Pending |
| AGENT-06 | Phase 5 | Pending |
| AGENT-07 | Phase 5 | Pending |
| AGENT-08 | Phase 5 | Pending |
| DECIDE-01 | Phase 6 | Pending |
| DECIDE-02 | Phase 6 | Pending |
| DECIDE-03 | Phase 6 | Pending |
| AUDIT-01 | Phase 6 | Pending |
| AUDIT-02 | Phase 6 | Pending |
| AUDIT-03 | Phase 6 | Pending |
| AUDIT-04 | Phase 6 | Pending |
| SCRIPT-01 | Phase 6 | Pending |
| SCRIPT-02 | Phase 6 | Pending |
| SCRIPT-03 | Phase 6 | Pending |
| CONSOLE-01 | Phase 4 | Pending |
| CONSOLE-02 | Phase 4 | Pending |
| CONSOLE-03 | Phase 4 | Pending |
| VIZ-01 | Phase 7 | Pending |
| VIZ-02 | Phase 7 | Pending |
| VIZ-03 | Phase 7 | Pending |
| VIZ-04 | Phase 7 | Pending |
| VIZ-05 | Phase 7 | Pending |
| DB-01 | Phase 1 | Complete |
| DB-02 | Phase 1 | Complete |
| DB-03 | Phase 3 | Complete |
| DB-04 | Phase 3 | Complete |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| PLAT-04 | Phase 4 | Complete |
| PLAT-05 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 59 total
- Mapped to phases: 59
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after roadmap creation*
