# VIBE OS — Claude Code Build Prompt

> Copy this entire file and paste it as your first message to Claude Code in the project root directory.
> Before starting, run: `mkdir vibe-os && cd vibe-os`

---

## Prompt

You are building **VIBE OS**, a Tauri v2 desktop application — an agentic Python development environment that integrates Claude Code, Jira, repo management, skills-based context loading, micro-decision logging, audit trails, live frontend preview, architecture visualization, and a prompt composition layer. Think of it as RStudio meets mission control for AI-assisted Python development.

This is a real product. Build it to production standards. No placeholder "TODO" comments — every panel must be functional.

---

## TECH STACK — NON-NEGOTIABLE

- **Shell**: Tauri v2 (Rust backend, webview frontend)
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 with a custom dark theme (defined below)
- **Editor**: Monaco Editor (`@monaco-editor/react`)
- **State**: Zustand (single global store with slices)
- **IPC**: Tauri's `invoke` command system for all Rust↔JS communication
- **Database**: SQLite via `rusqlite` in the Rust backend for decisions, audit logs, and session state
- **Process management**: Tauri's `Command` API (sidecar) for Python subprocess + Claude Code CLI
- **HTTP client**: `reqwest` in Rust for Jira API calls
- **Syntax highlighting**: Monaco handles this natively
- **Architecture graph**: D3.js force-directed graph
- **Live preview**: Embedded `<webview>` tag pointing at localhost dev server

---

## PROJECT STRUCTURE

Create this exact file tree. Do not deviate.

```
vibe-os/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json          # Tauri v2 permissions
│   └── src/
│       ├── main.rs               # Tauri entry point
│       ├── lib.rs                 # Module declarations
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── python.rs          # Python subprocess management
│       │   ├── claude.rs          # Claude Code CLI integration
│       │   ├── jira.rs            # Jira REST API client
│       │   ├── repos.rs           # Git clone, index, file tree
│       │   ├── skills.rs          # Skill file discovery and loading
│       │   ├── decisions.rs       # Micro-decision CRUD (SQLite)
│       │   ├── audit.rs           # Audit log append + query (SQLite)
│       │   ├── session.rs         # Session state management
│       │   ├── preview.rs         # Dev server management for live preview
│       │   └── architecture.rs    # AST-based repo structure analysis
│       ├── db/
│       │   ├── mod.rs
│       │   └── schema.rs          # SQLite table definitions + migrations
│       ├── models/
│       │   ├── mod.rs
│       │   ├── decision.rs        # MicroDecision struct
│       │   ├── audit_entry.rs     # AuditEntry struct
│       │   ├── jira_ticket.rs     # JiraTicket struct
│       │   ├── repo.rs            # Repo struct
│       │   ├── skill.rs           # Skill struct
│       │   └── session.rs         # WorkSession struct
│       └── services/
│           ├── mod.rs
│           ├── prompt_composer.rs  # Assembles system + task + skill + repo context
│           └── event_stream.rs     # Parses Claude Code stdout into structured events
├── src/
│   ├── main.tsx                   # React entry
│   ├── App.tsx                    # Root layout with resizable panes
│   ├── store/
│   │   ├── index.ts               # Zustand store with all slices
│   │   ├── slices/
│   │   │   ├── session.ts         # Active repos, skills, session timer
│   │   │   ├── editor.ts          # Open files, active tab, cursor position
│   │   │   ├── console.ts         # Python REPL history
│   │   │   ├── chat.ts            # Claude conversation messages
│   │   │   ├── agent.ts           # Agent stream events
│   │   │   ├── decisions.ts       # Micro-decision records
│   │   │   ├── audit.ts           # Audit trail entries
│   │   │   ├── jira.ts            # Jira tickets + filters
│   │   │   ├── repos.ts           # Repo list + activation state
│   │   │   ├── skills.ts          # Skill list + toggle state + token budget
│   │   │   └── preview.ts         # Live preview URL + refresh state
│   │   └── types.ts               # All TypeScript interfaces
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TitleBar.tsx        # App title bar with session badges
│   │   │   ├── StatusBar.tsx       # Bottom status bar
│   │   │   ├── ResizablePane.tsx   # Generic resizable pane (horizontal + vertical)
│   │   │   ├── TabStrip.tsx        # Reusable tab bar component
│   │   │   ├── PanelHeader.tsx     # Section header with title + actions
│   │   │   └── MainLayout.tsx      # Three-column layout orchestration
│   │   ├── left/
│   │   │   ├── RepoManager.tsx     # Repo list with checkboxes, branch, file count
│   │   │   ├── SkillsPanel.tsx     # Skill toggles with token budget bar
│   │   │   ├── JiraPanel.tsx       # Jira sprint board with filters
│   │   │   ├── PromptLayer.tsx     # Editable prompt viewer (system/task/repo tabs)
│   │   │   └── ClaudeChat.tsx      # Chat interface with working indicator
│   │   ├── center/
│   │   │   ├── CodeEditor.tsx      # Monaco editor wrapper
│   │   │   ├── LivePreview.tsx     # Embedded webview for frontend preview
│   │   │   ├── ArchViewer.tsx      # D3 force graph of repo architecture
│   │   │   └── Console.tsx         # Python REPL with history
│   │   ├── right/
│   │   │   ├── AgentStream.tsx     # Real-time agent event feed
│   │   │   ├── DecisionLog.tsx     # Micro-decision records with confidence
│   │   │   └── AuditLog.tsx        # Immutable session audit trail
│   │   └── shared/
│   │       ├── Badge.tsx
│   │       ├── Dot.tsx             # Status indicator dot (with optional pulse)
│   │       ├── IconButton.tsx
│   │       └── Tooltip.tsx
│   ├── hooks/
│   │   ├── useTauriCommand.ts      # Generic invoke wrapper with error handling
│   │   ├── usePythonProcess.ts     # Python subprocess lifecycle
│   │   ├── useClaudeStream.ts      # Claude Code stdout event stream parser
│   │   ├── useJiraSync.ts          # Jira polling + mutation
│   │   └── useSessionTimer.ts      # Elapsed session time
│   ├── lib/
│   │   ├── tauri.ts                # Typed Tauri invoke bindings
│   │   ├── eventParser.ts          # Parses Claude Code CLI output into AgentEvent objects
│   │   ├── promptTemplate.ts       # Prompt assembly logic (mirrors Rust composer)
│   │   └── tokenCounter.ts         # Approximate token counting for skills budget
│   └── styles/
│       └── globals.css             # Tailwind imports + custom scrollbar + animations
├── skills/                         # Default skill files shipped with app
│   ├── pandas-mastery.md
│   ├── xgboost-patterns.md
│   ├── async-python.md
│   ├── pytest-practices.md
│   ├── fastapi-conventions.md
│   ├── sql-optimization.md
│   └── matplotlib-seaborn.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── index.html
└── README.md
```

---

## DESIGN SYSTEM

### Color Palette (use these exact values in tailwind.config.ts as `colors.v.*`)

```
bg:            #08090d
bgAlt:         #0c0e14
surface:       #12141c
surfaceHi:     #181b26
surfaceActive: #1e2233
border:        #1f2336
borderHi:      #2a2f45
borderAccent:  #3d4470
text:          #b8bdd4
textDim:       #5a6080
textBright:    #e4e7f2
white:         #f0f2fa
accent:        #5b7cfa
accentBright:  #7d9bff
accentDim:     #2a3466
green:         #34d399
greenDim:      #0f2922
yellow:        #fbbf24
yellowDim:     #2a2410
orange:        #f97316
red:           #ef4444
redDim:        #2a1010
purple:        #a78bfa
purpleDim:     #1e1a33
cyan:          #22d3ee
cyanDim:       #0a2a30
```

### Typography

- **UI text**: `"Instrument Sans"` (Google Fonts) — weights 400, 500, 600, 700
- **Code / monospace**: `"JetBrains Mono"` (Google Fonts) — weights 400, 500, 600
- **Display / branding**: `"Space Mono"` (Google Fonts) — weight 700
- Base font size: 12px for dense panels, 13px for editor and chat
- Line height: 1.4 for UI, 1.54 (20px) for code

### Component Patterns

- All panels have a `PanelHeader` (10px uppercase label, icon, optional action buttons)
- Tab strips: 11px font, 2px bottom border on active, no background change
- Badges: 10px, 2px 7px padding, 4px border-radius, colored background at 15% opacity
- Status dots: 6px circles, optional CSS `pulse` animation (2s infinite, opacity 1→0.4)
- All hover states: transition 120ms, background → surfaceHi
- Scrollbars: 5px wide, borderHi thumb, transparent track
- Border pattern: 1px solid `border` between all panels, `borderHi` on hover for resize handles
- Resize handles: 2px wide/tall, cursor col-resize/row-resize, accent color on hover

---

## LAYOUT SPECIFICATION

The app is a three-column resizable layout with a title bar and status bar:

```
┌──────────────────────────────────────────────────────────────────┐
│ TITLE BAR: "VIBE OS" branding | session badges | settings       │
├───────────────┬──────────────────────┬───────────────────────────┤
│ LEFT (22%)    │ CENTER (40%)         │ RIGHT (38%)               │
│               │                      │                           │
│ [Tab Strip]   │ [Tab Strip]          │ [Tab Strip]               │
│ Repos         │ Live Preview         │ Agent Stream              │
│ Skills        │ Architecture         │ Decisions                 │
│ Jira          │ Editor               │ Audit Log                 │
│ Prompt Layer  │ Console              │                           │
│               │                      │                           │
│ ──resizable── │                      │                           │
│               │                      │                           │
│ Claude Chat   │                      │                           │
│ (always vis.) │                      │                           │
├───────────────┴──────────────────────┴───────────────────────────┤
│ STATUS BAR: Python status | Claude status | Jira sync | metrics │
└──────────────────────────────────────────────────────────────────┘
```

- Left column splits vertically: top panel (tabbed: Repos/Skills/Jira/Prompt) 55%, Claude Chat 45%. Both resizable.
- Center column splits vertically: top panel (tabbed: Preview/Arch/Editor) 60%, Console 40%. Resizable.
- All three columns are horizontally resizable.
- Minimum column widths: left 15%, center 25%, right 20%.

---

## FEATURE SPECIFICATIONS

### 1. Repo Manager (`repos.rs` + `RepoManager.tsx`)

**Rust backend:**
- `clone_repo(url: String, target_dir: String)` → shells out to `git clone`
- `list_repo_files(repo_path: String)` → recursive file tree as JSON
- `get_repo_branches(repo_path: String)` → list branches via `git branch -a`
- `index_repo(repo_path: String)` → reads all .py files, extracts module names, function signatures, class names. Returns a `RepoIndex` struct with: `{ modules: Vec<ModuleInfo>, total_files: usize, total_lines: usize, primary_language: String }`
- Store repos in `~/.vibe-os/repos/` directory

**Frontend:**
- Each repo row shows: checkbox (active/inactive), repo name in monospace, org label, branch name (purple), file count
- Active repos get a 2px left accent border
- Language badge (yellow for Python, orange for Swift, etc.)
- "+" button opens a dialog to paste a git URL
- When a repo is toggled ON: invoke `index_repo`, send the index to the prompt composer, update the architecture graph
- When toggled OFF: remove from prompt context, update graph

### 2. Skills Manager (`skills.rs` + `SkillsPanel.tsx`)

**Rust backend:**
- `discover_skills(skills_dir: String)` → reads all .md files from the skills directory
- `load_skill(path: String)` → returns file content as string
- `estimate_tokens(content: String)` → rough token count (chars / 4)
- Default skills directory: `~/.vibe-os/skills/` (copy bundled skills on first launch)
- Also scan for project-local skills in `{repo_root}/.vibe/skills/`

**Frontend:**
- Each skill row: checkbox, skill name, category badge (data/ml/core/web/infra/viz), token count
- Category colors: data=cyan, ml=yellow, core=accent, web=green, infra=purple, viz=orange
- Token budget bar at top: shows total loaded tokens vs a 20k soft limit
- Bar color: accent under 75%, orange 75-90%, red above 90%
- Checked skills get their content injected into the prompt via the prompt composer
- Opacity 0.45 when unchecked

### 3. Jira Integration (`jira.rs` + `JiraPanel.tsx`)

**Rust backend:**
- `configure_jira(base_url: String, email: String, api_token: String, project_key: String)` → stores config in SQLite
- `fetch_sprint_tickets(project_key: String)` → hits Jira REST API v3: `GET /rest/api/3/search?jql=project={key} AND sprint in openSprints()`
- `update_ticket_status(ticket_key: String, transition_id: String)` → `POST /rest/api/3/issue/{key}/transitions`
- `link_ticket_to_session(ticket_key: String, session_id: String)` → stores in SQLite
- `add_ticket_comment(ticket_key: String, comment: String)` → `POST /rest/api/3/issue/{key}/comment`
- Poll every 60 seconds for sprint updates

**Frontend:**
- Filter buttons: Sprint (default) | Mine | Linked
- Each ticket: priority color bar (left edge, 3px — critical=red, high=orange, med=yellow, low=textDim)
- Ticket key in monospace accent color, "LINKED" green dot badge if linked to session
- Title, status badge (colored), story points, assignee initials
- Click ticket → detail modal with description + ability to link/unlink from session
- When agent updates a ticket status, the Jira panel reflects it immediately

### 4. Prompt Layer (`prompt_composer.rs` + `PromptLayer.tsx`)

**Rust backend (`prompt_composer.rs`):**
- `compose_prompt(session: &WorkSession)` → assembles the full prompt from:
  1. **System prompt**: Base instructions for the agent (editable, stored in SQLite)
  2. **Task context**: Currently linked Jira tickets with descriptions
  3. **Skill context**: Content of all active skill files, concatenated
  4. **Repo context**: Index summaries of all active repos (module list, key functions, architecture notes)
- Returns `ComposedPrompt { system: String, task: String, skills: String, repo: String, total_tokens: usize }`

**Frontend:**
- Three sub-tabs: System | Task | Repo
- Each shows the composed prompt text in a monospace readonly textarea
- System tab is editable — changes persist to SQLite
- Shows total token count at the bottom
- "Copy Full Prompt" button that copies the entire composed prompt

### 5. Claude Code Integration (`claude.rs` + `ClaudeChat.tsx` + `useClaudeStream.ts`)

**Rust backend:**
- `start_claude_session(working_dir: String, prompt: String)` → spawns `claude` CLI process as a child process via Tauri Command API
- `send_to_claude(session_id: String, message: String)` → writes to the process stdin
- `kill_claude_session(session_id: String)` → kills the child process
- Stdout from the claude process is streamed back to the frontend via Tauri events (`tauri::Emitter`)
- Event name: `claude-stream`
- Each line of stdout is parsed by `event_stream.rs` into structured `AgentEvent` objects

**`event_stream.rs` parser:**
Parse Claude Code's output into event types:
- `Think` — when Claude is reasoning (starts with reasoning/analysis text)
- `Decision` — when Claude states a choice with rationale
- `FileCreate` — when a file is created (parse path + line count)
- `FileModify` — when a file is modified (parse path + diff stats)
- `TestRun` — when tests are executed (parse pass/fail counts)
- `JiraUpdate` — when a Jira ticket reference is detected in output
- `PreviewUpdate` — when frontend files are modified
- `Error` — when errors occur

Each event gets: `{ timestamp, event_type, content, metadata }` and is both emitted to the frontend AND written to the audit log.

**Frontend chat:**
- Session start indicator with loaded context summary
- User messages right-aligned, accent background
- Assistant messages left-aligned, surfaceHi background
- "Working..." indicator with pulsing dot when Claude is processing
- Code blocks within messages get syntax highlighting via a simple regex-based highlighter
- "Send to editor" badges on messages that contain code

### 6. Agent Stream (`AgentStream.tsx`)

- Receives events from the `claude-stream` Tauri event listener
- Each event renders as a row: timestamp (9px mono, dim) | type icon (colored) | content | optional badges
- Type icons and colors:
  - Think: ◉ accent
  - Decision: ◆ yellow
  - FileCreate/FileModify: ▪ green, with "+N / -N lines" badge
  - TestRun: ▸ cyan, with PASS/FAIL badge
  - JiraUpdate: ◈ purple
  - PreviewUpdate: ◐ orange
  - Error: ✕ red
- Auto-scrolls to bottom
- Decision events show confidence badge (green >90%, yellow 80-90%, orange <80%)
- Fade-slide-in animation on new events (0.3s ease, translateY 4px→0)

### 7. Micro-Decision Log (`decisions.rs` + `DecisionLog.tsx`)

**Rust backend:**
- `record_decision(decision: MicroDecision)` → inserts into SQLite `decisions` table
- `get_session_decisions(session_id: String)` → returns all decisions for current session
- `export_decisions(session_id: String, format: String)` → exports as JSON or CSV

**MicroDecision struct:**
```rust
pub struct MicroDecision {
    pub id: String,              // UUID
    pub session_id: String,
    pub timestamp: String,       // ISO 8601
    pub decision: String,        // What was decided
    pub rationale: String,       // Why
    pub confidence: f64,         // 0.0 - 1.0
    pub impact_category: String, // "perf" | "accuracy" | "dx" | "security" | "architecture"
    pub reversible: bool,
    pub related_files: Vec<String>,
    pub related_tickets: Vec<String>,
}
```

**Frontend:**
- Each decision card: left border colored by impact category
- Header row: timestamp, impact badge, confidence badge, reversibility indicator (↺)
- Decision text in textBright, 12px
- Rationale text in textDim, 10.5px
- Export button (⤓) in panel header

### 8. Audit Trail (`audit.rs` + `AuditLog.tsx`)

**Rust backend:**
- `log_action(entry: AuditEntry)` → inserts into SQLite `audit_log` table
- `get_session_audit(session_id: String)` → returns all entries for session
- EVERY action goes through this: file changes, Jira updates, prompt sends, skill toggles, repo activations, test runs, decisions, errors

**AuditEntry struct:**
```rust
pub struct AuditEntry {
    pub id: String,
    pub session_id: String,
    pub timestamp: String,
    pub action_type: String,     // FILE_CREATE, FILE_MODIFY, JIRA_UPDATE, TEST_RUN, PROMPT_SENT, SESSION_START, SKILL_TOGGLE, REPO_ACTIVATE, PREVIEW_UPDATE, DECISION_MADE, ERROR
    pub detail: String,
    pub actor: String,           // "agent" | "user" | "system"
    pub metadata: Option<String>, // JSON string for extra data
}
```

**Frontend:**
- Dense table layout: timestamp | action_type (colored, 9px bold) | detail | actor
- Action type colors: FILE_*=green, JIRA_*=purple, TEST_*=cyan, PROMPT_*=accent, SESSION_*=yellow, SKILL_*=orange, REPO_*=accent, PREVIEW_*=orange, DECISION_*=yellow, ERROR=red
- Export button in header

### 9. Architecture Visualizer (`architecture.rs` + `ArchViewer.tsx`)

**Rust backend:**
- `analyze_architecture(repo_paths: Vec<String>)` → for each active repo:
  - Walk all .py files
  - Extract: module names, imports (to build dependency edges), class names, function names
  - Return `ArchGraph { nodes: Vec<ArchNode>, edges: Vec<ArchEdge> }`
- `ArchNode`: `{ id, label, node_type (module|class|function), repo_name, file_path }`
- `ArchEdge`: `{ from_id, to_id, edge_type (import|inheritance|call) }`

**Frontend:**
- D3.js force-directed graph
- Nodes colored by repo (each active repo gets a distinct color from the palette)
- Node size by importance (number of incoming edges)
- Edges as dashed lines, low opacity
- Hover a node → highlight its connections, show tooltip with file path and function list
- "Rebuild" button to re-analyze after file changes
- Smooth physics simulation with drag support
- Glow filter on important nodes (>3 connections)

### 10. Live Preview (`preview.rs` + `LivePreview.tsx`)

**Rust backend:**
- `start_dev_server(project_dir: String, command: String)` → spawns the project's dev server (e.g., `python -m http.server`, `npm run dev`, `streamlit run`)
- `stop_dev_server()` → kills the dev server process
- `get_preview_url()` → returns `http://localhost:{port}`

**Frontend:**
- Browser chrome mockup at top: traffic light dots, URL bar showing localhost:{port}, green "Live" dot
- Embedded `<iframe>` or Tauri `<webview>` pointed at the dev server URL
- Auto-refreshes when file change events are detected (debounced 500ms)
- "Auto-refresh" toggle in header

### 11. Code Editor (`CodeEditor.tsx`)

- Monaco Editor with Python language support
- File tabs with close buttons
- Opens files from the active repos when clicked in the file tree
- Receives code from Claude chat ("send to editor" action)
- On save (Cmd+S): write file back to disk via Tauri command, trigger audit log entry
- Theme: custom Monaco theme matching VIBE OS color palette
- Minimap enabled, scrollbar styled to match

### 12. Console (`Console.tsx`)

**Rust backend (`python.rs`):**
- `start_python(working_dir: String, venv_path: Option<String>)` → spawns Python REPL as subprocess
- `send_python(command: String)` → writes to stdin
- `kill_python()` → kills process
- Stdout/stderr streamed via Tauri events

**Frontend:**
- History of input/output entries with syntax coloring
- Input line at bottom with `>>>` prompt
- Input: cyan, output: text, errors: red, system messages: textDim
- Up/down arrow for command history
- Auto-scroll to bottom on new output

### 13. Title Bar (`TitleBar.tsx`)

- Left: "VIBE OS" in Space Mono 700 with accent→cyan gradient
- Subtitle: "Agentic Development System" in 10px textDim
- Session active badge (green dot + "Session Active")
- Right: Badge cluster showing active repo count, active skill count, total context tokens
- Settings gear icon button

### 14. Status Bar (`StatusBar.tsx`)

- Left: Python status dot + version, Claude Code status dot, Jira sync status dot, active repo count
- Right: Session elapsed time, decision count, action count, API token usage
- All text 10px monospace, textDim color
- Pipe separators between items

---

## SQLite SCHEMA

Create in `db/schema.rs`. Run migrations on app startup.

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    active_repos TEXT NOT NULL DEFAULT '[]',    -- JSON array
    active_skills TEXT NOT NULL DEFAULT '[]',   -- JSON array
    system_prompt TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    decision TEXT NOT NULL,
    rationale TEXT NOT NULL,
    confidence REAL NOT NULL,
    impact_category TEXT NOT NULL,
    reversible INTEGER NOT NULL DEFAULT 1,
    related_files TEXT NOT NULL DEFAULT '[]',
    related_tickets TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    action_type TEXT NOT NULL,
    detail TEXT NOT NULL,
    actor TEXT NOT NULL,
    metadata TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS jira_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    base_url TEXT NOT NULL,
    email TEXT NOT NULL,
    api_token TEXT NOT NULL,
    project_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

---

## TAURI v2 CONFIGURATION

### `tauri.conf.json` key settings:
- App identifier: `com.vibeos.app`
- Window: 1440x900 default, min 1024x700, decorations: false (custom title bar)
- Allowed Tauri APIs: shell (for subprocess), fs (for file access), dialog, event, path
- Security: allow localhost connections for preview webview

### `capabilities/default.json`:
Enable these permissions:
- `core:default`
- `shell:allow-spawn`
- `shell:allow-stdin-write`
- `shell:allow-kill`
- `fs:allow-read`
- `fs:allow-write`
- `event:default`
- `dialog:default`
- `path:default`

---

## BUILD ORDER

Execute in this exact sequence. Complete each phase fully before moving on. Run `cargo check` and `npm run build` at the end of each phase to verify no compilation errors.

### Phase 1: Scaffold
1. `npm create tauri-app@latest vibe-os -- --template react-ts` (or set up manually with Vite + React + TS + Tauri v2)
2. Install frontend deps: `npm install zustand @monaco-editor/react d3 @types/d3 uuid @types/uuid`
3. Install Tailwind CSS v4: follow Tailwind v4 + Vite setup
4. Add Google Fonts (Instrument Sans, JetBrains Mono, Space Mono) to `index.html`
5. Configure the full color palette in `tailwind.config.ts`
6. Set up the Zustand store with all slices (can be empty initially)
7. Create all directories and empty files matching the project structure above
8. Add Rust dependencies to Cargo.toml: `rusqlite` (with "bundled" feature), `serde`, `serde_json`, `uuid`, `reqwest` (with "json" feature), `tokio`, `chrono`
9. Verify: `cargo check` and `npm run dev` both work

### Phase 2: Core Layout
1. Build `ResizablePane.tsx` — must support both horizontal and vertical modes
2. Build `TabStrip.tsx`, `PanelHeader.tsx`, `Badge.tsx`, `Dot.tsx`, `IconButton.tsx`
3. Build `TitleBar.tsx` and `StatusBar.tsx`
4. Build `MainLayout.tsx` orchestrating the three-column layout with tab state
5. Wire it all together in `App.tsx`
6. Add global CSS: scrollbar styles, pulse animation, fadeSlideIn animation
7. Verify: app launches with the correct layout, all panes resize, tabs switch

### Phase 3: Database + Models
1. Implement `db/schema.rs` with migration runner
2. Implement all model structs in `models/`
3. Implement `commands/session.rs`: create session, end session, get active session
4. Implement `commands/decisions.rs`: record, query, export
5. Implement `commands/audit.rs`: log, query, export
6. Wire all commands into `main.rs` via `.invoke_handler()`
7. Verify: `cargo check` passes, commands are callable from frontend

### Phase 4: Repo + Skills + Prompt
1. Implement `commands/repos.rs`: clone, list files, index, get branches
2. Implement `commands/skills.rs`: discover, load, estimate tokens
3. Implement `services/prompt_composer.rs`: assemble full prompt from session state
4. Build `RepoManager.tsx` connected to Rust backend
5. Build `SkillsPanel.tsx` connected to Rust backend
6. Build `PromptLayer.tsx` showing composed prompt
7. Bundle default skill .md files and copy to `~/.vibe-os/skills/` on first launch
8. Verify: can add repos, toggle skills, see composed prompt update

### Phase 5: Python + Console
1. Implement `commands/python.rs`: start REPL, send command, kill, stream stdout
2. Build `Console.tsx` connected to Python subprocess
3. Add command history (up/down arrows)
4. Verify: can start Python, execute commands, see output

### Phase 6: Claude Code Integration
1. Implement `commands/claude.rs`: start session, send message, kill, stream stdout
2. Implement `services/event_stream.rs`: parse Claude output into AgentEvent structs
3. Build `ClaudeChat.tsx` with streaming responses
4. Build `AgentStream.tsx` receiving parsed events
5. Build `useClaudeStream.ts` hook for frontend event handling
6. Wire agent events to audit log (every event → audit entry)
7. Wire decision events to decision log
8. Verify: can chat with Claude, see events stream, decisions logged

### Phase 7: Jira
1. Implement `commands/jira.rs`: configure, fetch tickets, update status, add comment, link to session
2. Build `JiraPanel.tsx` with filters and ticket display
3. Add settings dialog for Jira configuration (base URL, email, API token, project key)
4. Wire agent Jira events to actual Jira API calls
5. Verify: can see sprint tickets, link tickets, agent can update status

### Phase 8: Architecture + Preview + Editor
1. Implement `commands/architecture.rs`: analyze Python files, build graph
2. Build `ArchViewer.tsx` with D3 force graph
3. Implement `commands/preview.rs`: start/stop dev server
4. Build `LivePreview.tsx` with iframe and auto-refresh
5. Build `CodeEditor.tsx` with Monaco, file tabs, save-to-disk
6. Wire file change events to preview refresh and architecture rebuild
7. Verify: architecture graph renders from real repos, preview shows dev server, editor saves files

### Phase 9: Polish
1. Wire all components to audit logging (every user action → audit entry)
2. Status bar: wire real data (session timer, decision count, token usage)
3. Add keyboard shortcuts: Cmd+S (save), Cmd+Enter (send chat), Cmd+R (run Python)
4. Add error handling and loading states to all panels
5. Custom Monaco theme matching VIBE OS palette
6. Test full workflow: activate repos → load skills → link Jira tickets → chat with Claude → watch agent work → see decisions + audit trail
7. Build for release: `npm run tauri build`

---

## CRITICAL IMPLEMENTATION NOTES

1. **All subprocess management must use Tauri's Command/sidecar API**, not raw `std::process::Command`. This is required for proper lifecycle management in Tauri v2.

2. **Event streaming pattern**: Rust spawns a child process, reads stdout line by line in a tokio task, emits each line as a Tauri event. Frontend listens via `listen()` from `@tauri-apps/api/event`.

3. **State flow**: Frontend state lives in Zustand. Persistent state (sessions, decisions, audit, settings) is in SQLite accessed via Tauri commands. The Zustand store hydrates from SQLite on app launch.

4. **Error handling**: Every Tauri command returns `Result<T, String>`. Frontend `invoke` calls are wrapped in try/catch with toast notifications for errors.

5. **File paths**: Use Tauri's `path` API to resolve `~/.vibe-os/` cross-platform. Never hardcode paths.

6. **Security**: Jira API token is stored in SQLite. In v2, move to OS keychain via `tauri-plugin-stronghold` or similar.

7. **The prompt composer is the brain**: It's the single function that determines what Claude sees. It must be deterministic, debuggable, and the PromptLayer panel must show its exact output.

8. **Audit log is append-only**: Never delete or modify audit entries. This is the compliance layer.

9. **Monaco editor**: Use the `@monaco-editor/react` package. Register a custom theme on mount. Set language to "python" for .py files.

10. **D3 in React**: Use `useRef` for the SVG container and `useEffect` for D3 rendering. Do not let React manage D3's DOM nodes.

---

Now build it. Start with Phase 1.
