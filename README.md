<p align="center">
  <img src="https://img.shields.io/badge/VIBE_OS-v0.3.0-5b7cfa?style=for-the-badge&labelColor=08090d" alt="VIBE OS v0.3.0" />
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

# Run tests (43 tests across Rust + TypeScript)
npm run test:all

# Launch in development mode (starts Vite + Tauri together)
npm run tauri dev

# Build distributable binary (Windows/macOS/Linux)
npm run tauri build
```

First launch creates your database at `~/.vibe-os/vibe-os.db` and copies starter skill files to `~/.vibe-os/skills/`.

---

## What It Does

VIBE OS is a **conversation-first desktop IDE** for AI-assisted development. Every interaction happens through a full-width Claude chat, with project management, attention routing, and power tools surfaced through overlays and inline cards.

| Capability | What You Get |
|---|---|
| **Project Cards** | Home screen shows all projects as cards with live status, outcome badges, and attention indicators |
| **Full-Width Chat** | Single-project conversation view with Claude -- no column clutter, just the conversation |
| **Inline Activity Cards** | File creates, modifications, test runs, decisions, and errors render as typed cards inside the chat stream |
| **Outcome Detection** | Auto-detects session results: test pass/fail counts, build status, preview URLs, errors |
| **Attention Routing** | Pulsing indicators on project cards and title bar badge when sessions need your input; OS-level notifications |
| **Knowledge Graph** | Embedded SurrealDB graph database tracks every entity (code, decisions, tasks, skills) and relationship. Interactive D3 force-directed visualizer with filtering, search, and node inspection |
| **Settings Panel** | Always-visible right sidebar with 7 tabs: Repos, Skills, Tokens, Files, Audit, Events, Graph |
| **Editor Escape Hatch** | `Ctrl+Shift+C` opens a bottom Monaco editor panel; code blocks in chat have "View Code" buttons |
| **Code Block Summaries** | Agent code output collapses to `"python -- 42 lines"` with expand/collapse and one-click editor opening |
| **Token Control** | Per-skill, per-repo, and session-level token budgets with color-coded warnings |
| **Decision Logging** | Every architectural decision captured with rationale, confidence, impact category, and reversibility |
| **Audit Trail** | Append-only log of every action. Never deleted. Export to JSON/CSV. |
| **Workspace System** | Project workspaces with scaffolded directories, CLAUDE.md as system prompt, workspace-scoped repos/skills |
| **Multi-Session Chat** | Run multiple Claude Code sessions simultaneously with tab-based switching and input-needed alerts |

---

## The Interface

### Home Screen

```
+-----------------------------------------------------------------------+
|  VIBE OS                                     [gear] [minimize] [close] |
+-----------------------------------------------------------------------+
|                                                                       |
|   PROJECT CARDS                                                       |
|                                                                       |
|   +-------------------+  +-------------------+  +-----------------+   |
|   | my-api        (!) |  | frontend-app      |  | + New Project   |   |
|   | Working...        |  | idle              |  |                 |   |
|   | 12/12 tests pass  |  | Build OK          |  |                 |   |
|   | preview: :3000    |  |                   |  |                 |   |
|   +-------------------+  +-------------------+  +-----------------+   |
|                                                                       |
+-----------------------------------------------------------------------+
```

Each project card shows:
- Live session status (idle / working / input needed)
- Attention flag (pulsing orange when input is needed)
- Outcome badges: test results, build status, preview URLs, errors

### Conversation View

```
+-----------------------------------------------------------------------+
|  VIBE OS  |  my-api  Session1  Session2  +       [gear] [min] [close] |
+-----------------------------------------------------------------------+
|                                                                       |
|  > scaffold the REST endpoints                                        |
|                                                                       |
|  [activity] Created src/routes/users.ts                               |
|  [activity] Modified src/index.ts                                     |
|                                                                       |
|  Sure, I've created the REST endpoints...                             |
|                                                                       |
|  [python -- 24 lines]                            [> expand] [View Code]|
|                                                                       |
|  [decision] REST over GraphQL (confidence: 85%)                       |
|                                                                       |
|  [outcome] 12/12 tests passing | Build OK | Preview: localhost:3000   |
|                                                                       |
|  +--------------------------------------------------------------+    |
|  | Type a message...                                    [Send]   |    |
|  +--------------------------------------------------------------+    |
+-----------------------------------------------------------------------+
```

**Overlays (no column disruption):**
- **Settings Panel** (right slide-in, 400px): Repos, Skills, Tokens, Files, Audit, Events tabs
- **Editor Panel** (bottom slide-in, 60vh): Full Monaco editor with `Ctrl+Shift+C` toggle

---

## Features in Depth

### Project Cards & Home Screen (v3)

The home screen replaces the old multi-column layout with a card-based project overview:

- **Create** projects from the home screen -- named, timestamped, ready to chat
- **Project cards** show live status with outcome badges (test counts, build status, preview URLs)
- **Attention routing** flags projects that need your input with pulsing indicators
- **Click a card** to enter the full-width conversation view
- **OS notifications** via Tauri notification plugin when background sessions need attention

### Conversation Cards (v3)

Claude's responses include structured inline cards instead of raw text:

| Card Type | What It Shows |
|---|---|
| **ActivityLine** | File creates, modifications, test runs -- typed and color-coded |
| **OutcomeCard** | Session results: test pass/fail, build status, preview URLs |
| **ErrorCard** | Errors with retry button |
| **InlineDecisionCard** | Architectural decisions with confidence and impact |
| **InlinePreviewCard** | Preview URL thumbnails |
| **TestDetailCard** | Test suite results with pass/fail breakdown |
| **CodeBlockSummary** | Collapsed code with line count, expand toggle, and "View Code" button |

### Knowledge Graph (v3)

An embedded SurrealDB graph database that connects every entity in the development process:

- **11 node types**: repo, module, function, class, ticket, skill, decision, action, test, session, prompt
- **16 edge types**: structural (imports, calls, inherits), reasoning (informed_by, modified, addresses), work (implemented_by, depends_on), context (included_in, produced), temporal (occurred_in, followed)
- **D3 force-directed visualizer** with colored nodes by type, directed edges, drag/zoom/pan
- **Type filter toggles** to show/hide node categories
- **Search** across all node labels
- **Click-to-inspect** panel showing full node properties
- **Hover** highlights connected edges, dims unrelated nodes
- **Composite queries**: provenance trace, impact radius, session report, skill effectiveness

The graph answers questions like: "Show me every decision that touched this function." "Which skills drive the highest-confidence decisions?" "What's the blast radius if I change this module?"

### Settings Sidebar (v3)

Always-visible right sidebar in conversation view with 7 tabs:

| Tab | Content |
|---|---|
| **Repos** | Add/remove git repositories, toggle active context |
| **Skills** | Browse and toggle skill files |
| **Tokens** | Per-skill and per-repo token budgets with color-coded bars |
| **Files** | Workspace file tree (click opens editor panel) |
| **Audit** | Append-only action log with JSON/CSV export |
| **Events** | Real-time agent event stream (think, decision, file ops, tests) |
| **Graph** | Interactive knowledge graph visualizer |

### Editor Escape Hatch (v3)

- **`Ctrl+Shift+C`** toggles a bottom Monaco editor panel (60vh)
- **Code block summaries** in chat show `"language -- N lines"` with expand/collapse
- **"View Code" button** on each code block opens it in the editor panel
- **Files tab** in settings: clicking a file auto-opens the editor
- Monaco instance stays mounted (CSS display toggle) so editor state persists

### Workspace System

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

### Multi-Session Claude Chat

- Run **multiple concurrent Claude sessions**, each with its own subprocess, conversation history, and working state
- **Session tabs** in the chat area for switching between active sessions
- **Input-needed alerts** -- pulsing orange dot when a background session needs your attention

### Token Control

- **Per-skill limits** -- cap how many tokens each skill can consume
- **Per-repo limits** -- cap context from each repository
- **Session budget** -- overall token ceiling with color-coded warnings (green/orange/red)
- Budget enforcement during prompt composition with soft truncation

### Decision Log & Audit Trail

- **Decisions** -- impact category, confidence score, reversibility, expandable rationale
- **Audit** -- append-only, never deleted, exportable to JSON/CSV
- Both are the compliance and transparency layer

---

## Testing

VIBE OS has **43 tests** across the stack:

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
|  Monaco Editor . D3.js . Zustand . Lucide         |
+--------------------------------------------------+
|               Tauri v2 IPC Bridge                  |
+--------------------------------------------------+
|                  Backend (Rust)                     |
|  Tokio . SQLite (WAL) . SurrealDB (embedded)      |
|  Serde . std::process . Claude CLI subprocess     |
+--------------------------------------------------+
```

### State Management

Zustand store with **16 slices**, persisted to SQLite via a custom storage adapter:

| Slice | Responsibility |
|---|---|
| `projectSlice` | Project CRUD, active project, project card state |
| `sessionSlice` | Active session lifecycle |
| `agentSlice` | Multi-session chat, agent events, outcome detection, CLI validation |
| `repoSlice` | Repository list and activation state |
| `skillSlice` | Skill discovery and toggle state |
| `promptSlice` | System prompt, task context, composed prompt |
| `editorSlice` | Open files, active file, save with timestamp |
| `consoleSlice` | REPL output, command history |
| `decisionSlice` | Decision records, loading, export |
| `auditSlice` | Audit entries, loading, export |
| `diffSlice` | Pending diffs, accept/reject flow |
| `previewSlice` | Preview URL, auto-refresh toggle |
| `workspaceSlice` | Workspace CRUD, file tree, CLAUDE.md watcher |
| `layoutSlice` | Settings panel, editor panel, drawer state |
| `dashboardSlice` | Session goal |
| `tokenSlice` | Token budgets, budget enforcement |

### Component Architecture

```
src/components/
  home/          # HomeScreen, project cards
  layout/        # TitleBar, MainLayout, TabStrip
  conversation/  # ActivityLine, OutcomeCard, ErrorCard, InlineDecisionCard,
                 # InlinePreviewCard, TestDetailCard, CodeBlockSummary
  panels/        # ClaudeChat, RepoManager, SkillsPanel, TokenControlPanel,
                 # WorkspaceTree, AuditLog, AgentStream
  settings/      # SettingsPanel (right slide-in overlay)
  editor/        # EditorPanel (bottom slide-in overlay)
  center/        # CodeEditor (Monaco), MermaidPanel
  shared/        # Reusable UI primitives
  modals/        # Modal dialogs
```

### Databases

**SQLite** (WAL mode) for operational data: `sessions`, `settings`, `audit_log`, `decisions`, `claude_sessions`, `token_budgets`. Schema migrations via `PRAGMA user_version`.

**SurrealDB** (embedded, kv-surrealkv) for the knowledge graph: 11 node tables, 16 edge tables, indexes on all hot paths. Stores at `~/.vibe-os/graph/`. Queried via SurrealQL with composite graph traversals (provenance, impact, session reports).

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+C` | Toggle editor panel (escape hatch) |
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
