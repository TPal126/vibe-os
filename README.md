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

# Run tests (142 tests across Rust + TypeScript)
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

- **Multi-Project Dashboard** -- live project cards with status, outcome badges, and attention routing
- **Conversation-First IDE** -- full-width chat with inline activity cards, code summaries, and rich agent output
- **Multi-Session Agents** -- run multiple Claude Code sessions simultaneously with tab switching and attention indicators
- **Knowledge Graph** -- embedded SurrealDB graph connecting code, decisions, actions, and tests; interactive D3 visualizer
- **Visibility & Audit** -- every decision and action captured, append-only, exportable to JSON/CSV
- **Context Control** -- workspaces, CLAUDE.md system prompt, repo/skill toggles, and per-scope token budgets

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

### 1. Multi-Project Dashboard

The home screen shows every project as a card with live status. Each card surfaces what matters: is Claude working, idle, or waiting for you? How did the last run end -- tests passing, build errors, preview running? Projects that need your attention pulse orange with a count badge in the title bar. Click a card to enter its conversation. OS-level desktop notifications fire when a background session needs input.

### 2. Conversation-First IDE

Every interaction happens through a full-width chat. No column clutter -- just you and Claude. Agent activity streams into the conversation as typed inline cards: file creates and modifications, test results with pass/fail breakdowns, architectural decisions with confidence scores, errors with retry buttons, and live preview thumbnails when a dev server spins up. Code blocks collapse to a one-line summary with language and line count -- expand inline or open in the editor.

### 3. Multi-Session Agents

Run multiple Claude Code sessions simultaneously, each in its own subprocess with independent conversation history. Switch between sessions via tabs. Background sessions that need input surface through attention routing -- pulsing tab indicators, project card badges, and OS notifications so nothing blocks silently.

### 4. Knowledge Graph

An embedded SurrealDB graph database auto-indexes your code (repos, modules, functions, classes) and connects them to every decision, action, test, and skill from your sessions. Ask questions like "what decisions touched this function?" or "what breaks if I change this module?" through provenance and impact queries. An interactive D3 force-directed visualizer lets you filter by node type, search, and click-to-inspect.

### 5. Visibility & Audit

Every architectural decision is captured with rationale, confidence score, impact category, and reversibility. Every agent action -- file creates, test runs, prompts sent -- lands in an append-only audit log that is never deleted. Both are exportable to JSON or CSV.

### 6. Context Control

Workspaces organize repos, skills, and docs into a single directory with a CLAUDE.md that serves as the live-reloading system prompt. Toggle repos and skills on/off to control what context Claude sees. Set token budgets per skill, per repo, or per session with color-coded warnings. When you need to touch code directly, `Ctrl+Shift+C` opens a bottom Monaco editor panel -- code blocks in chat have a "View Code" button that opens them there.

---

## Testing

VIBE OS has **142 tests** across the stack:

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
| **eventParser** | 30 | Type guards, code block extraction, session ID, input requests, dev server URL extraction, test result parsing |
| **agentSlice** | 32 | Session lifecycle, chat messages, duplication prevention, status derivation, multi-session routing, attention tracking, rich cards, outcomes |
| **projectSlice** | 7 | Project CRUD, max 5 enforcement, navigation |
| **layoutSlice** | 6 | Editor/settings panel toggles |
| **tokenSlice** | 5 | Budget CRUD, scope lookups |
| **Rust event_stream** | 22 | CLI output parsing, event classification, serialization |
| **Rust SQLite** | 11 | Decision persistence/scoping/export, audit CRUD/limit/export, workspace scaffolding, token budgets |
| **Rust SurrealDB** | 29 | Node CRUD, edge creation, population pipeline, graph queries, provenance, impact, session reports |

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
