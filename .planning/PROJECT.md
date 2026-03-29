# VIBE OS

## What This Is

VIBE OS is a Tauri v2 desktop application -- an AI project control room where you direct multiple Claude agents across different applications and see outcomes, not code. Think of it as a director's dashboard: you give instructions, agents build, and you see running previews, test results, and deploy status. The app tells you when something needs your attention. Built as a public product for developers who want to work at a higher level of abstraction.

## Core Value

Developers direct AI agents across multiple projects simultaneously, see outcomes instead of code, and only engage when the agent needs guidance -- no staring at diffs, no monitoring terminal output, no context-switching between IDEs.

## Current Milestone

**v3: Project Cards + Attention Routing** -- Replace the multi-panel IDE with a card-based home screen. 3-5 project cards, each running an independent Claude agent. Cards show outcomes (live previews, test badges, status), not code. Cards pulse when they need you. Click to open the conversation. Inspired by Gastown's thesis (manage multiple Claude Code instances) but focused on making 3-5 projects effortless instead of 30 projects possible.

## Milestone History

### v1 (Complete, Phases 1-7)
Full IDE with editor, console, agent integration, decisions, audit, D3 visualization. Code-editor-centric.

### v2 (Complete, Phases 8-11 + post-phase fixes)
Workspace system, conversation-first layout, multi-session, token control, Mermaid diagrams, session dashboard. Still showed too much: 10+ panels, raw agent events, code-level detail. Post-phase: rewrote CLI integration against real stream-json format, fixed infinite re-render, added 67 tests.

### v3 (Active)
Chat-dominant redesign. Outcome-focused. Multi-project. Attention-driven.

## Requirements

### Validated (v1+v2 Complete)
- [x] Tauri v2 scaffold, SQLite, shell plugin, dark theme, typography
- [x] Repo/skill context management with checkbox toggles
- [x] Claude Code CLI integration with streaming and event parsing (rewritten against real format)
- [x] Agent events, decisions, audit trail (backend works, frontend needs redesign)
- [x] Workspace system with CLAUDE.md, file tree, scaffolding
- [x] Multi-session Claude support with per-session state
- [x] Token control with per-skill/repo/session budgets
- [x] 67 tests across Rust parser and frontend

### Active (v3)
- [ ] Project cards home screen: 3-5 cards with status, outcome thumbnails, one-line agent summary
- [ ] Conversation view: full-width chat, inline outcomes/activity/decisions/errors, no side panels
- [ ] Attention routing: cards pulse when they need you, global "N need you" count, OS notifications
- [ ] Outcome previews: live iframes, test badges, build status on cards and in conversation
- [ ] Settings & escape hatch: v2 features behind gear icon, Show Code shortcut for power users

### Out of Scope
- Jira integration -- defer further
- OAuth/authentication -- desktop app
- Plugin marketplace -- skills system covers this
- Real-time collaboration -- single-user
- Inline tab autocomplete -- not an IDE anymore
- Mobile or web deployment -- Tauri desktop only
- Code editing -- users don't want to see code, they want outcomes

## Constraints

- **Tech stack**: Tauri v2 (Rust), React 18 + TypeScript + Vite, Tailwind CSS v4, Zustand, SQLite
- **Desktop only**: 1440x900 default, min 1024x700, custom title bar
- **Process management**: std::process::Command for Claude CLI (Tauri shell plugin PATH broken on Windows)
- **Event streaming**: Rust reads stdout line-by-line, emits Tauri events, frontend routes by session ID
- **Audit log**: Append-only, never delete -- but surface inline, not in separate panel
- **Backward compat**: v2 backend (workspaces, sessions, token budgets, audit) is preserved; v3 is a frontend redesign
- **Testing**: 67 existing tests must continue passing; new features need tests against real CLI fixtures

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| v1: Python-first | Primary audience | Standing |
| v1: Skills as core differentiator | Checkboxable context loading | Standing |
| v1: Public product from day one | UX polish matters | Standing |
| v2: Conversation-first layout | Chat is primary surface | Standing, amplified in v3 |
| v2: Workspace system | Project-scoped context | Standing |
| v2: Mermaid over D3 | Simpler, more readable | Standing but may go on-demand |
| v2: Multi-session support | Power users run multiple sessions | Evolving → multi-project in v3 |
| v3: Outcome over code | Users want to see the running app, not the diff | New |
| v3: Attention-driven UX | App tells you when to engage, you don't monitor | New |
| v3: Kill the 3-column layout | Too much surface area, too many panels | New |
| v3: 3-5 projects, not 30 | Gastown proves the model; we make it effortless for normal developers | New |
| v3: Attention routing is the product | The hard problem isn't running agents, it's knowing which one to talk to next | New |

---
*Last updated: 2026-03-29 after v3 milestone initialization*
