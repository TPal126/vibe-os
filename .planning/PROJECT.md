# VIBE OS

## What This Is

VIBE OS is a Tauri v2 desktop application -- a workspace-first vibe coding tool where the primary activity is directing Claude through conversation and managing context, not manually editing code. It combines the visual clarity of RStudio (everything visible, tight feedback loops, no context-switching) with the power of Claude Code. Developers can visualize their codebase, load context via checkboxable skills and repos, direct an AI agent through a centered chat interface, and see every decision the agent makes -- all in a single pane-of-glass interface. Built as a public product for developers.

## Core Value

Developers can see, understand, and direct every decision an AI coding agent makes -- no invisible choices, no vanishing context, no trust gaps.

## Current Milestone

**v2: Workspace-First Vibe Coding Overhaul** -- Restructure from a code-editor-centric IDE into a conversation-first vibe coding tool. Introduce workspace system, center Claude Chat as the primary surface, add multi-session support, direct token control, Mermaid architecture diagrams, and a session dashboard.

## Requirements

### Validated (v1 Complete)

- [x] Three-column resizable layout with custom title bar, status bar, dark theme
- [x] Repo manager with checkbox activation, branch display, file indexing
- [x] Skills manager with checkbox toggles, category badges, and token budget bar
- [x] Prompt composer that assembles system + task + skill + repo context
- [x] Claude Code CLI integration with streaming chat and event parsing
- [x] Agent event stream with typed, color-coded events
- [x] Micro-decision log with rationale, confidence, and impact category
- [x] Append-only audit trail logging every action
- [x] Architecture visualizer (D3 force graph) -- being replaced in v2
- [x] Live preview panel with embedded webview
- [x] Monaco code editor with file tabs, Python support, custom dark theme
- [x] Python REPL console with history and subprocess management
- [x] Custom dark theme with design system
- [x] SQLite backend for sessions, decisions, audit log, and settings
- [x] Title bar with session badges and status indicators
- [x] Status bar with Python/Claude/sync status and session metrics

### Active (v2)

- [ ] Workspace system: directory scaffolding, CLAUDE.md as system prompt, workspace file tree
- [ ] Layout restructure: Claude Chat centered, session dashboard, decisions anchored right, secondary panels in drawer
- [ ] Multi-session Claude support with visual switcher and input-needed alerts
- [ ] Direct token control with fine-grained budget management
- [ ] Mermaid architecture diagram (replaces D3 force graph)
- [ ] Session dashboard with current goal, context summary, activity feed, stats
- [ ] Checkbox persistence fix for repo/skill toggles across tab navigation

### Out of Scope

- Jira integration -- defer to v3, focus on workspace + conversation experience
- OAuth/authentication -- desktop app, no auth needed
- Multi-language AST analysis -- Python-first; extensibility is a later concern
- Mobile or web deployment -- Tauri desktop only
- Plugin/extension marketplace -- skills system covers this
- Real-time collaboration -- single-user
- Inline tab autocomplete -- Copilot/Cursor territory

## Context

- v1 is feature-complete (Phases 1-7): full IDE with editor, console, agent integration, decisions, audit, visualization
- v2 pivots the UX philosophy: conversation-first, not code-editor-first
- The workspace system introduces project-scoped context (CLAUDE.md, local skills, cloned repos) vs the global approach in v1
- Secondary panels (Monaco editor, Console, Preview, Diff) become overlay/drawer content, not permanent screen real estate
- Mermaid replaces D3 for architecture visualization -- simpler, more readable, less custom code to maintain

## Constraints

- **Tech stack**: Tauri v2 (Rust backend), React 18 + TypeScript + Vite, Tailwind CSS v4, Monaco Editor, Zustand, Mermaid.js, SQLite (rusqlite) -- D3 being phased out
- **Desktop only**: Tauri v2, window 1440x900 default, min 1024x700, custom title bar (decorations: false)
- **Subprocess management**: Must use Tauri's Command/sidecar API, not raw std::process::Command
- **Event streaming**: Rust spawns child processes, reads stdout line-by-line in tokio task, emits Tauri events to frontend
- **State flow**: Frontend in Zustand, persistent state in SQLite via Tauri commands, hydrate on launch
- **Audit log**: Append-only, never delete or modify entries
- **File paths**: Use Tauri's path API for cross-platform resolution, never hardcode
- **Workspace paths**: ~/vibe-workspaces/ as default root, configurable

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Defer Jira to v3 | Focus v2 on workspace + conversation experience; Jira adds complexity | -- Pending |
| Python-first, extensible later | Python is the primary audience | -- Standing |
| Follow spec in spirit, not letter | Smart deviations are expected | -- Standing |
| Skills as core differentiator | Checkboxable context loading | -- Standing |
| Public product from day one | UX polish and onboarding matter | -- Standing |
| v2: Conversation-first layout | Claude Chat is the primary surface, not the code editor | -- Pending |
| v2: Workspace system | Project-scoped context via directory structure replaces ad-hoc repo/skill management | -- Pending |
| v2: Mermaid over D3 | Simpler, more readable, less custom code; D3 force graph was impressive but hard to maintain | -- Pending |
| v2: Secondary panel drawer | Editor/Console/Preview/Diff don't need permanent screen space in a vibe coding workflow | -- Pending |
| v2: Multi-session support | Power users run multiple Claude sessions; need visual management and input alerts | -- Pending |

---
*Last updated: 2026-03-28 after v2 milestone initialization*
