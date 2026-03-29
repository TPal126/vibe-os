<p align="center">
  <img src="https://img.shields.io/badge/VIBE_OS-v0.1.0-5b7cfa?style=for-the-badge&labelColor=08090d" alt="VIBE OS v0.1.0" />
  <img src="https://img.shields.io/badge/Tauri-v2-24C8D8?style=for-the-badge&logo=tauri&logoColor=white&labelColor=08090d" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white&labelColor=08090d" alt="React 18" />
  <img src="https://img.shields.io/badge/Rust-1.77+-DEA584?style=for-the-badge&logo=rust&logoColor=white&labelColor=08090d" alt="Rust" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=08090d" alt="TypeScript" />
</p>

<h1 align="center">
  <br />
  <code style="font-size: 2em;">VIBE OS</code>
  <br />
  <sub>Agentic Development System</sub>
</h1>

<p align="center">
  <strong>See every decision. Direct every action. Audit everything.</strong>
  <br />
  A desktop IDE where you visualize your codebase, load context like checking a box,<br />
  chat with Claude, and watch every agent decision in real time.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#what-it-does">What It Does</a> &bull;
  <a href="#the-interface">The Interface</a> &bull;
  <a href="#features-in-depth">Features</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#keyboard-shortcuts">Shortcuts</a>
</p>

---

## The Problem

AI coding tools are black boxes. You paste a prompt, hope for the best, and get back code you didn't watch being written. You can't see what context the model used, what decisions it made, or why it chose one approach over another.

**VIBE OS makes AI-assisted development visible, auditable, and directable.**

---

## Quick Start

### Prerequisites

| Requirement | Version | Why |
|---|---|---|
| **Node.js** | 18+ | Frontend build tooling |
| **Rust** | 1.77+ | Tauri backend compilation |
| **Python** | 3.8+ | Integrated REPL console |
| **Claude Code CLI** | Latest | AI agent backbone |
| **Git** | Any | Repository management |

### Install & Run

```bash
# Clone
git clone https://github.com/TPal126/vibe-os.git
cd vibe-os

# Install frontend dependencies
npm install

# Launch in development mode (starts Vite + Tauri together)
npm run tauri dev

# Build distributable binary (Windows/macOS/Linux)
npm run tauri build
```

That's it. First launch creates your database at `~/.vibe-os/vibe-os.db` and copies starter skill files to `~/.vibe-os/skills/`.

---

## What It Does

VIBE OS is a **single-pane-of-glass IDE** for AI-assisted Python development. Think RStudio's visual clarity meets Claude Code's power.

| Capability | What You Get |
|---|---|
| **Context Loading** | Check a box to load repos and skills into Claude's prompt. Like `library()` in R. |
| **Prompt Transparency** | See the exact prompt Claude receives — system, task, skills, repo context — in a debuggable panel. |
| **Streaming Chat** | Talk to Claude with real-time token streaming. Code blocks have "Open in Editor" buttons. |
| **Agent Event Stream** | Watch Claude think, create files, modify code, run tests — every action typed and color-coded. |
| **Decision Logging** | Every architectural decision captured with rationale, confidence score, impact category, and reversibility. |
| **Append-Only Audit Trail** | Every action (yours, Claude's, system's) logged with timestamps. Never deleted. Export to JSON/CSV. |
| **Architecture Visualization** | Interactive D3 force graph of your Python codebase — modules, classes, imports — colored by repo. |
| **Diff Review** | Agent-proposed file changes shown in a Monaco diff editor. Accept or reject before anything hits disk. |
| **Live Preview** | Embed your running dev server (Streamlit, Flask, Vite, etc.) with auto-refresh on file save. |
| **Python REPL** | Built-in console with command history, colored output, and subprocess management. |
| **Monaco Editor** | Multi-tab code editor with the VIBE OS dark theme, Ctrl+S save with audit logging. |
| **Skill Generation** | Turn any script from your session into a reusable `.md` skill file for future sessions. |

---

## The Interface

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  VIBE OS   Agentic Development System    ● Active   2 repos  3 skills      │
├───────────────────┬────────────────────────┬─────────────────────────────────┤
│                   │                        │                                 │
│   ┌─────────────┐ │  ┌──────────────────┐  │  ┌───────────────────────────┐  │
│   │ Repos       │ │  │ Preview          │  │  │ Agent Stream              │  │
│   │ Skills      │ │  │ Architecture     │  │  │ Decisions                 │  │
│   │ Prompt Layer│ │  │ Editor           │  │  │ Audit Log                 │  │
│   └─────────────┘ │  │ Diff             │  │  │ Scripts                   │  │
│   ┌─────────────┐ │  └──────────────────┘  │  └───────────────────────────┘  │
│   │             │ │  ┌──────────────────┐  │                                 │
│   │ Claude Chat │ │  │ Python Console   │  │                                 │
│   │             │ │  │ >>>              │  │                                 │
│   └─────────────┘ │  └──────────────────┘  │                                 │
├───────────────────┴────────────────────────┴─────────────────────────────────┤
│  ● Python: idle   ● Claude: working   │ Session: 0:14:32  Decisions: 7      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Three resizable columns** (drag the separators):

| Column | Default Width | Panels |
|---|---|---|
| **Left** | 22% | Repos, Skills, Prompt Layer (tabbed) + Claude Chat (fixed below) |
| **Center** | 40% | Preview, Architecture, Editor, Diff (tabbed) + Python Console (fixed below) |
| **Right** | 38% | Agent Stream, Decisions, Audit Log, Scripts (tabbed) |

**Title Bar** — Live indicators: session status, active repo count, active skill count, total context tokens (color-coded by budget).

**Status Bar** — Python process status, Claude status (idle/working/error with pulsing dots), session elapsed time, decision count, action count.

---

## Features in Depth

### Context Assembly — The Core Differentiator

VIBE OS treats context like a **composable pipeline**. Instead of manually writing prompts, you assemble them:

1. **Repos** — Add git repositories by URL. Toggle them active with a checkbox. Active repos get indexed (modules, classes, functions) and their structure is injected into the prompt.

2. **Skills** — Markdown files in `~/.vibe-os/skills/` that contain reusable knowledge (patterns, techniques, domain context). Check the ones you want. Each shows its token count and category badge (`data` `ml` `core` `web` `infra` `viz`).

3. **Token Budget Bar** — Visual progress bar showing how much of your context budget active skills consume. Green under 50%, yellow at 50-80%, red above 80%.

4. **Prompt Layer** — Four sub-tabs showing exactly what Claude will see:
   - **System** — Editable system prompt (debounced 500ms save to SQLite)
   - **Task** — Your current task context
   - **Skills** — Concatenated content of all checked skills
   - **Repo** — Summaries of active repository structures
   - One-click "Copy Full Prompt" to clipboard

### Architecture Viewer

Interactive **D3.js force-directed graph** of your Python codebase:

- **Nodes** = Python modules, classes. Colored by which repo they belong to (8 distinct colors). Sized by importance (incoming dependency count).
- **Edges** = import relationships. Dashed lines at 30% opacity.
- **Glow effect** on high-connectivity nodes (>3 incoming edges).
- **Hover** any node to highlight its connections and see a tooltip with file path and function list. Everything else dims to 20% opacity.
- **Drag** nodes to rearrange. **Zoom** with scroll wheel.
- **Rebuild** button re-analyzes after code changes.

The Rust backend (`architecture_commands.rs`) walks all `.py` files, extracts modules/imports/classes/functions via regex, resolves internal import edges, and drops external library imports for a clean graph.

### Diff Review

When Claude proposes file changes, they appear as **pending diffs** in the Diff tab:

- **Sidebar** lists all pending changes with filename and timestamp
- **Main area** shows a **Monaco DiffEditor** — original on the left, proposed on the right, side-by-side
- **Accept** writes the change to disk, updates the editor if the file is open, and logs a `FILE_MODIFY` audit entry
- **Reject** discards the change and logs a `FILE_REJECT` entry

No file changes hit disk until you explicitly accept them.

### Agent Event Stream

Real-time feed of everything Claude does, with typed, color-coded entries:

| Event | Color | Badge |
|---|---|---|
| `think` | Blue | — |
| `decision` | Orange | Confidence % |
| `file_create` | Green | — |
| `file_modify` | Green | +/- line counts |
| `test_run` | Cyan | PASS / FAIL |
| `preview_update` | Orange | — |
| `error` | Red | — |
| `result` | Gray | Duration, cost |

Events auto-scroll with a fade-slide-in animation. Each has a precise timestamp.

### Decision Log

Every agent decision captured with:

- **Impact category** — `perf` (cyan), `accuracy` (green), `dx` (blue), `security` (red), `architecture` (purple) — shown as a colored left border
- **Confidence** — 0-100%, badge colored green (>90%), yellow (80-90%), orange (<80%)
- **Reversibility** indicator
- **Expandable** — click to reveal rationale, related files, and related tickets
- **Export** — JSON or CSV via native save-as dialog

### Audit Trail

Append-only log of every action in the system:

| Action Type | Color | Examples |
|---|---|---|
| `FILE_CREATE` `FILE_MODIFY` `FILE_SAVE` | Green | File operations |
| `TEST_RUN` | Cyan | Test executions |
| `PROMPT_SENT` | Blue | Prompt submissions |
| `SESSION_START` `SESSION_END` | Yellow | Session lifecycle |
| `SKILL_TOGGLE` | Orange | Skill activation |
| `REPO_ACTIVATE` | Blue | Repo toggling |
| `DECISION_MADE` | Yellow | Decision records |
| `ERROR` | Red | Errors |

Each entry shows timestamp, colored action type, detail message, and actor (`agent` / `user` / `system`). Exportable to JSON/CSV. **Never deleted or modified** — this is the compliance layer.

### Skills System

Skills are **markdown files** that inject domain knowledge into Claude's context:

```
~/.vibe-os/skills/
├── python-basics.md      # Core Python patterns (list comps, pathlib, dataclasses)
├── debugging.md          # pdb, breakpoint(), traceback analysis
├── my-api-patterns.md    # Your custom patterns (generated from scripts)
└── ...
```

**Built-in skills** are bundled with the app and copied on first launch. You can:
- Write your own `.md` files and drop them in `~/.vibe-os/skills/`
- **Generate skills from scripts** — click "→ Skill" on any Python script in the Scripts Tracker to auto-generate a skill file from it
- Skills from active repos are also discovered (project-local `{repo}/.vibe/skills/`)

### Live Preview

Point it at any running dev server:
- Enter `http://localhost:3000` (or 8501, 5000, whatever your framework uses)
- Browser chrome mockup with traffic light dots, URL bar, green "Live" indicator
- **Auto-refresh** on file save — debounced 500ms, only triggers when you actually save a file
- Toggle auto-refresh on/off. Manual refresh button always available.
- Sandboxed iframe for security

### Python Console

Built-in REPL with subprocess management:
- Colored output: input (cyan), output (white), errors (red), system messages (dim)
- **Command history** — arrow up/down to navigate
- **Restart** and **Clear** buttons in the toolbar
- Status shown in the bottom status bar (idle/running with pulsing dot)

---

## Architecture

### Tech Stack

```
┌─────────────────────────────────────────────────┐
│                  Frontend                        │
│  React 18 · TypeScript 5.5 · Vite 6 · Tailwind 4│
│  Monaco Editor · D3.js · Zustand · Lucide       │
├─────────────────────────────────────────────────┤
│               Tauri v2 IPC Bridge                │
├─────────────────────────────────────────────────┤
│                  Backend (Rust)                   │
│  Tokio · SQLite (WAL) · Serde · Shell Plugin     │
│  Claude CLI subprocess · File I/O · Regex        │
└─────────────────────────────────────────────────┘
```

**~4,700 lines of TypeScript/React** + **~2,200 lines of Rust** across 80 source files.

### Data Flow

```
User clicks checkbox  →  Zustand store action  →  Tauri IPC invoke
                                                        ↓
                                                  Rust command handler
                                                        ↓
                                              SQLite / File system / Claude CLI
                                                        ↓
                                                  Response to frontend
                                                        ↓
                                              Store update → React re-render
```

### State Management

Zustand store with **11 slices**, persisted to SQLite via a custom storage adapter:

| Slice | Responsibility |
|---|---|
| `sessionSlice` | Active session lifecycle |
| `repoSlice` | Repository list and activation state |
| `skillSlice` | Skill discovery and toggle state |
| `promptSlice` | System prompt, task context, composed prompt |
| `editorSlice` | Open files, active file, save with timestamp |
| `consoleSlice` | REPL output, command history |
| `agentSlice` | Chat messages, agent events, working state |
| `decisionSlice` | Decision records, loading, export |
| `auditSlice` | Audit entries, loading, export |
| `diffSlice` | Pending diffs, accept/reject flow |
| `previewSlice` | Preview URL, auto-refresh toggle |

Only `systemPrompt` and `activeSession` are persisted across app restarts. Everything else hydrates fresh from the backend.

### Rust Backend Commands

| Module | Commands |
|---|---|
| `architecture_commands.rs` | `analyze_architecture` — walks Python files, builds dependency graph |
| `claude_commands.rs` | `start_claude`, `send_message`, `cancel_claude` — Claude CLI subprocess |
| `context_commands.rs` | `discover_skills`, `clone_repo`, `get_repos`, `index_repo`, `compose_prompt` |
| `decision_commands.rs` | `record_decision`, `get_decisions`, `export_decisions` |
| `audit_commands.rs` | `log_action`, `get_audit_log`, `export_audit_log` |
| `script_commands.rs` | `get_session_scripts`, `generate_skill_from_script` |
| `file_commands.rs` | `read_file`, `write_file` (with audit logging) |
| `db_commands.rs` | Session CRUD, settings CRUD |

### Database

SQLite with WAL mode at `~/.vibe-os/vibe-os.db`. Four tables: `sessions`, `settings`, `audit_log`, `decisions`. Schema migrations managed via `PRAGMA user_version` (currently at v4).

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+S` / `Cmd+S` | Save active file (audit logged) |
| `Ctrl+R` / `Cmd+R` | Focus Python console (prevents browser reload) |
| `Enter` (in chat) | Send message to Claude |
| `Shift+Enter` (in chat) | New line |
| `↑` / `↓` (in console) | Navigate command history |

Plus all standard Monaco editor shortcuts (find, replace, go to line, fold, format).

---

## Design System

A purpose-built dark theme optimized for extended coding sessions:

| Role | Color | Hex |
|---|---|---|
| Background | ![#08090d](https://via.placeholder.com/12/08090d/08090d.png) | `#08090d` |
| Surface | ![#12141c](https://via.placeholder.com/12/12141c/12141c.png) | `#12141c` |
| Border | ![#232738](https://via.placeholder.com/12/232738/232738.png) | `#232738` |
| Text | ![#b8bdd4](https://via.placeholder.com/12/b8bdd4/b8bdd4.png) | `#b8bdd4` |
| Text Hi | ![#e1e4f0](https://via.placeholder.com/12/e1e4f0/e1e4f0.png) | `#e1e4f0` |
| Dim | ![#5a6080](https://via.placeholder.com/12/5a6080/5a6080.png) | `#5a6080` |
| Accent | ![#5b7cfa](https://via.placeholder.com/12/5b7cfa/5b7cfa.png) | `#5b7cfa` |
| Green | ![#34d399](https://via.placeholder.com/12/34d399/34d399.png) | `#34d399` |
| Red | ![#f87171](https://via.placeholder.com/12/f87171/f87171.png) | `#f87171` |
| Orange | ![#fbbf24](https://via.placeholder.com/12/fbbf24/fbbf24.png) | `#fbbf24` |
| Cyan | ![#22d3ee](https://via.placeholder.com/12/22d3ee/22d3ee.png) | `#22d3ee` |

**Typography**: Instrument Sans (UI), JetBrains Mono (code), Space Mono (branding).

---

## Project Structure

```
vibe-os/
├── src/                          # React frontend
│   ├── components/
│   │   ├── center/               # CodeEditor, Console, EditorTabs
│   │   ├── layout/               # MainLayout, TitleBar, StatusBar, TabStrip, PanelHeader
│   │   ├── panels/               # All feature panels (13 panels)
│   │   ├── modals/               # AddRepoModal
│   │   └── shared/               # Badge, Dot, IconButton, Tooltip
│   ├── hooks/                    # useClaudeStream, usePythonProcess, useKeyboardShortcuts
│   ├── lib/                      # tauri.ts (IPC), monacoTheme, eventParser, tokens
│   └── stores/                   # Zustand store with 11 slices
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # 8 command modules
│   │   ├── services/             # event_stream.rs (Claude output parser)
│   │   ├── db.rs                 # SQLite init + migrations
│   │   └── lib.rs                # Tauri app setup + plugin registration
│   ├── skills/                   # Bundled .md skill files
│   └── capabilities/             # Shell + clipboard permissions
└── package.json                  # Frontend deps + scripts
```

---

## License

MIT

---

<p align="center">
  <sub>Built with Tauri v2, React 18, and Rust. Powered by Claude.</sub>
</p>
