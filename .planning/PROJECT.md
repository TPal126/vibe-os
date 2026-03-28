# VIBE OS

## What This Is

VIBE OS is a Tauri v2 desktop application — an agentic Python development environment that combines the visual clarity of RStudio (everything visible, tight feedback loops, no context-switching) with the power of Claude Code. It's a mission-control IDE where developers can visualize their codebase, load context via checkboxable skills and repos, direct an AI agent, and see every decision the agent makes — all in a single pane-of-glass interface. Built as a public product for Python developers.

## Core Value

Developers can see, understand, and direct every decision an AI coding agent makes — no invisible choices, no vanishing context, no trust gaps.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Three-column resizable layout (left: repos/skills/prompt + chat, center: preview/arch/editor + console, right: agent stream/decisions/audit)
- [ ] Repo manager with checkbox activation, branch display, file indexing
- [ ] Skills manager with checkbox toggles, category badges, and token budget bar (like RStudio library checkboxes)
- [ ] Prompt composer that assembles system + task + skill + repo context into a visible, debuggable prompt
- [ ] Claude Code CLI integration with streaming chat and event parsing
- [ ] Agent event stream with typed, color-coded events (think, decision, file changes, tests, errors)
- [ ] Micro-decision log capturing every agent choice with rationale, confidence, and impact category
- [ ] Append-only audit trail logging every action (file changes, prompt sends, skill toggles, etc.)
- [ ] Architecture visualizer (D3 force graph) showing module dependencies, classes, imports
- [ ] Live preview panel with embedded webview pointing at a dev server
- [ ] Monaco code editor with file tabs, Python support, custom dark theme
- [ ] Python REPL console with history and subprocess management
- [ ] Custom dark theme (design system with specific color palette, typography, component patterns)
- [ ] SQLite backend for sessions, decisions, audit log, and settings
- [ ] Title bar with session badges and status indicators
- [ ] Status bar with Python/Claude/sync status and session metrics

### Out of Scope

- Jira integration — defer to v2, focus on the core IDE experience first
- OAuth/authentication — desktop app, no auth needed for v1
- Multi-language AST analysis — Python-first; extensibility is a v2 concern
- Mobile or web deployment — Tauri desktop only
- Plugin/extension marketplace — skills system covers this for v1
- Real-time collaboration — single-user for v1

## Context

- The build prompt (`VIBE-OS-CLAUDE-CODE-PROMPT.md`) contains an extremely detailed specification including exact file tree, color palette, component specs, SQLite schema, Tauri v2 config, and a 9-phase build order. Follow the spirit of this spec rather than the letter — it's the blueprint, but smart deviations are expected.
- The design system is fully specified: dark theme with specific hex values, three Google Fonts (Instrument Sans, JetBrains Mono, Space Mono), dense panel layout with 12-13px base sizes.
- Skills are a core differentiator — loadable .md context files with token budget, presented as checkboxes exactly like R packages in RStudio. Users check the skills they want injected into the agent's prompt.
- The prompt composer is the brain of the system — it's the single function that determines what Claude sees. It must be deterministic, debuggable, and fully visible in the Prompt Layer panel.
- Architecture-first workflow: users visualize the codebase, identify what needs changing, then direct Claude through a mix of clicking graph nodes, typing in chat, or composing prompts.
- The audit trail is the trust layer. Every agent action logged, append-only, exportable. This is what makes AI "auditable" — you can always explain what happened and why.

## Constraints

- **Tech stack**: Tauri v2 (Rust backend), React 18 + TypeScript + Vite, Tailwind CSS v4, Monaco Editor, Zustand, D3.js, SQLite (rusqlite) — non-negotiable per spec
- **Desktop only**: Tauri v2, window 1440x900 default, min 1024x700, custom title bar (decorations: false)
- **Subprocess management**: Must use Tauri's Command/sidecar API, not raw std::process::Command
- **Event streaming**: Rust spawns child processes, reads stdout line-by-line in tokio task, emits Tauri events to frontend
- **State flow**: Frontend in Zustand, persistent state in SQLite via Tauri commands, hydrate on launch
- **Audit log**: Append-only, never delete or modify entries
- **File paths**: Use Tauri's path API for cross-platform resolution, never hardcode

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Defer Jira to v2 | Focus v1 on the core IDE + agent experience; Jira adds complexity without being essential to the core value | — Pending |
| Python-first, extensible later | Python is the primary audience; architecture should allow other languages but v1 only implements Python AST/REPL | — Pending |
| Follow spec in spirit, not letter | The build prompt is a detailed blueprint but smart deviations are expected as implementation reveals better approaches | — Pending |
| Skills as core differentiator | Checkboxable context loading (like RStudio library checkboxes) is what makes VIBE OS different from other AI IDE tools | — Pending |
| Public product from day one | Design for other developers, not just personal use — UX polish and onboarding matter | — Pending |

---
*Last updated: 2026-03-28 after initialization*
