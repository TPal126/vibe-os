<p align="center">
  <img src="https://img.shields.io/badge/VIBE_OS-v0.2.0-5b7cfa?style=for-the-badge&labelColor=08090d" alt="VIBE OS v0.2.0" />
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
  A conversation-first desktop IDE where you chat with Claude Code,<br />
  manage workspaces, control token budgets, and watch every agent decision in real time.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#what-it-does">What It Does</a> &bull;
  <a href="#the-interface">The Interface</a> &bull;
  <a href="#features-in-depth">Features</a> &bull;
  <a href="#testing">Testing</a> &bull;
  <a href="#architecture">Architecture</a>
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
| **Claude Code CLI** | Latest | AI agent backbone (`npm install -g @anthropic-ai/claude-code`) |
| **Git** | Any | Repository management |

### Install & Run

```bash
# Clone
git clone https://github.com/TPal126/vibe-os.git
cd vibe-os

# Install frontend dependencies
npm install

# Run tests (67 tests across Rust + TypeScript)
npm run test:all

# Launch in development mode (starts Vite + Tauri together)
npm run tauri dev

# Build distributable binary (Windows/macOS/Linux)
npm run tauri build
```

First launch creates your database at `~/.vibe-os/vibe-os.db` and copies starter skill files to `~/.vibe-os/skills/`.

---

## What It Does

VIBE OS is a **conversation-first desktop IDE** for AI-assisted development. Claude Chat is the primary surface, with context management, decision auditing, and workspace organization built around it.

| Capability | What You Get |
|---|---|
| **Workspace System** | Create/open project workspaces with scaffolded directories, CLAUDE.md as system prompt, and workspace-scoped repos/skills |
| **Multi-Session Chat** | Run multiple Claude Code sessions simultaneously with tab-based switching and input-needed alerts |
| **Token Control** | Set per-skill, per-repo, and session-level token budgets with color-coded warnings |
| **Context Loading** | Check a box to load repos and skills into Claude's prompt |
| **Agent Event Stream** | Watch Claude think, create files, modify code, run tests -- every action typed and color-coded |
| **Session Dashboard** | At-a-glance view of current goal, active context, activity feed, and session stats |
| **Decision Logging** | Every architectural decision captured with rationale, confidence, impact category, and reversibility |
| **Audit Trail** | Append-only log of every action. Never deleted. Export to JSON/CSV. |
| **Mermaid Diagrams** | Architecture diagrams generated from codebase analysis, rendered with Mermaid.js |
| **Secondary Panels** | Editor, Console, Preview, and Diff accessible via a toggleable drawer overlay |
| **Diff Review** | Agent-proposed file changes in a Monaco diff editor. Accept or reject before anything hits disk. |
| **Python REPL** | Built-in console with command history, colored output, and subprocess management |

---

## The Interface

```
+------------------+----------------------------+---------------------------+
|                  |                            |                           |
|  Repos           |  CLAUDE CHAT               |  Decisions                |
|  Skills          |  Session 1  Session 2  +   |  Agent Stream             |
|  Token Control   |                            |  Audit Log                |
|  [tabbed]        |  > hi                      |  [tabbed]                 |
|                  |  Hello! How can I help?    |                           |
|                  |                            |                           |
|------------------+----------------------------+                           |
|                  |                            |                           |
|  WORKSPACE       |  SESSION DASHBOARD         |  MERMAID DIAGRAM          |
|  FILES           |  Goal | Context | Stats    |  [architecture view]      |
|  [file tree]     |  Activity feed             |                           |
|                  |                            |                           |
+------------------+----------------------------+---------------------------+
|  Workspace  |  Python: idle  |  2 sessions (1 working)  |  v0.2.0       |
+-------------+----------------+--------------------------+----------------+
```

**Three resizable columns** (conversation-first layout):

| Column | Default | Content |
|---|---|---|
| **Left** (20%) | Top: Repos, Skills, Token Control (tabbed). Bottom: Workspace file tree |
| **Center** (45%) | Top: Claude Chat with session tabs. Bottom: Session Dashboard |
| **Right** (35%) | Top: Decisions, Agent Stream, Audit Log (tabbed). Bottom: Mermaid diagram |

**Secondary Drawer** -- Editor, Console, Preview, and Diff are accessible via the "Panels" button, sliding in as an overlay without disrupting the main layout.

---

## Features in Depth

### Workspace System (v2)

Workspaces organize all project context into a single directory:

```
~/vibe-workspaces/my-project/
+-- CLAUDE.md        # System prompt (editable, live-updating)
+-- docs/            # Project documentation
+-- repos/           # Cloned repositories
+-- skills/          # Workspace-local skill files
+-- data/            # Data files
+-- output/          # Generated output
```

- **Create** a workspace by name -- app scaffolds the directory structure
- **Open** an existing workspace -- app loads CLAUDE.md, discovers skills, lists repos
- **CLAUDE.md** serves as the system prompt (replaces the old editable textarea)
- **File tree** component shows workspace contents with expand/collapse and click-to-open

### Multi-Session Claude Chat (v2)

- Run **multiple concurrent Claude sessions**, each with its own subprocess, conversation history, and working state
- **Session tabs** in the chat area for switching between active sessions
- **Input-needed alerts** -- pulsing orange dot when a background session needs your attention
- **Session Dashboard** below chat shows goal, context summary, activity feed, and stats

### Token Control (v2)

- **Per-skill limits** -- cap how many tokens each skill can consume
- **Per-repo limits** -- cap context from each repository
- **Session budget** -- overall token ceiling with color-coded warnings (green/orange/red)
- Budget enforcement during prompt composition with soft truncation

### Context Assembly

1. **Repos** -- Add git repositories by URL. Toggle active with a checkbox. Active repos get indexed and injected into the prompt.
2. **Skills** -- Markdown files with reusable knowledge. Workspace-local skills override global ones on name conflicts.
3. **Prompt Composition** -- System (CLAUDE.md) + Task + Skills + Repo context, assembled deterministically with budget enforcement.

### Agent Event Stream

Real-time feed of everything Claude does:

| Event | Color | Description |
|---|---|---|
| `think` | Blue | Assistant text and reasoning |
| `decision` | Orange | Architectural decisions (with confidence) |
| `file_create` | Green | New files created |
| `file_modify` | Green | Files edited |
| `test_run` | Cyan | Test executions (PASS/FAIL) |
| `error` | Red | Errors |
| `result` | Gray | Completion with duration and cost |

### Decision Log & Audit Trail

- **Decisions** -- impact category, confidence score, reversibility, expandable rationale
- **Audit** -- append-only, never deleted, exportable to JSON/CSV
- Both are the compliance and transparency layer

---

## Testing

VIBE OS has **67 tests** across the full stack:

```bash
# Run all tests (TypeScript + Rust)
npm run test:all

# TypeScript only (Vitest)
npm run test

# Rust only (Cargo)
npm run test:rust

# Watch mode
npm run test:watch
```

### Test Coverage

| Area | Tests | What's Tested |
|---|---|---|
| **Rust event parser** | 24 | Real CLI output fixtures, assistant text extraction, tool use classification, result events, system events, edge cases, serialization for frontend |
| **Frontend eventParser** | 23 | Type guards (`isStatusEvent`, `isAgentEvent`, `isAssistantText`), code block extraction, session ID extraction, input request detection |
| **Frontend agentSlice** | 20 | Session lifecycle, chat message accumulation, duplication prevention, status derivation, legacy compatibility |

Tests use **real captured Claude CLI output** as fixtures, not assumed formats.

---

## Architecture

### Tech Stack

```
+--------------------------------------------------+
|                  Frontend                         |
|  React 18 . TypeScript 5.5 . Vite 6 . Tailwind 4 |
|  Monaco Editor . Mermaid.js . Zustand . Lucide    |
+--------------------------------------------------+
|               Tauri v2 IPC Bridge                  |
+--------------------------------------------------+
|                  Backend (Rust)                     |
|  Tokio . SQLite (WAL) . Serde . std::process      |
|  Claude CLI subprocess . File I/O . Regex          |
+--------------------------------------------------+
```

### State Management

Zustand store with **15 slices**, persisted to SQLite via a custom storage adapter:

| Slice | Responsibility |
|---|---|
| `sessionSlice` | Active session lifecycle |
| `repoSlice` | Repository list and activation state |
| `skillSlice` | Skill discovery and toggle state |
| `promptSlice` | System prompt, task context, composed prompt |
| `editorSlice` | Open files, active file, save with timestamp |
| `consoleSlice` | REPL output, command history |
| `agentSlice` | Multi-session chat, agent events, CLI validation |
| `decisionSlice` | Decision records, loading, export |
| `auditSlice` | Audit entries, loading, export |
| `diffSlice` | Pending diffs, accept/reject flow |
| `previewSlice` | Preview URL, auto-refresh toggle |
| `workspaceSlice` | Workspace CRUD, file tree, CLAUDE.md watcher |
| `layoutSlice` | Drawer state, active drawer tab |
| `dashboardSlice` | Session goal |
| `tokenSlice` | Token budgets, budget enforcement |

### Database

SQLite with WAL mode. Tables: `sessions`, `settings`, `audit_log`, `decisions`, `claude_sessions`, `token_budgets`. Schema migrations via `PRAGMA user_version`.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+S` / `Cmd+S` | Save active file (audit logged) |
| `Ctrl+R` / `Cmd+R` | Focus Python console |
| `Enter` (in chat) | Send message to Claude |
| `Shift+Enter` (in chat) | New line |

---

## Design System

Dark theme optimized for extended coding sessions:

| Role | Hex |
|---|---|
| Background | `#08090d` |
| Surface | `#12141c` |
| Border | `#232738` |
| Text | `#b8bdd4` |
| Accent | `#5b7cfa` |
| Green | `#34d399` |
| Red | `#f87171` |
| Orange | `#fbbf24` |
| Cyan | `#22d3ee` |

**Typography**: Instrument Sans (UI), JetBrains Mono (code), Space Mono (branding).

---

## License

MIT

---

<p align="center">
  <sub>Built with Tauri v2, React 18, and Rust. Powered by Claude.</sub>
</p>
