# vibe-os UI Redesign: Quadrant Layout with Live Architecture

**Date:** 2026-03-30
**Status:** Approved (design phase)

## Problem

vibe-os currently uses a two-column layout (chat + right sidebar) with 7 tabs crammed into a single settings panel. The knowledge graph is buried in a tab. Context controls (skills, repos, tokens) are hidden behind navigation. For developers running multiple independent Claude sessions across repos, there's no way to see architecture, context composition, or cross-repo relationships at a glance.

The app wraps Claude CLI but doesn't yet deliver on the core value proposition: **making the invisible context around your code visible and controllable**.

## Design Philosophy

Inspired by RStudio — which showed R developers their environment, packages, plots, and connections alongside the console — vibe-os should show developers their architecture, context layer, and activity alongside the chat.

Three principles:

1. **Everything visible simultaneously** — no hidden panels hiding value
2. **Context is controllable** — toggle skills, repos, and budgets in real-time with immediate feedback
3. **Sessions are independent worlds** — switching tabs reorients the full cockpit

## Target Users

- **Primary:** Power developers running multiple Claude Code sessions who need visibility and control over token usage, context composition, and agent activity
- **Secondary:** Developers newer to AI-assisted coding who want a more approachable interface than raw CLI

## 1. Enhanced Home Screen — Living Project Cards

### Current State
Static project card grid (max 5 projects). Cards show status, summary, test results, and preview thumbnail. No visibility into active sessions.

### New Design
Project cards become mini-dashboards:

- **Active session count** badge (e.g., "2 active") with color coding
- **Session list** within the card showing each session's name, status dot (green/yellow/gray), and which repo it's targeting
- **Click a session** to jump directly into that session's quadrant view
- **Click the card title** to enter the project with the last-active session
- **Cost tracking** per project per day (e.g., "$1.24 today")
- **"+ New session"** link within the card for quick session creation

Layout remains a 3-column grid with "New Project" card at the end.

## 2. Quadrant Layout — The Cockpit

### Current State
Two-column: full-width chat (left) + collapsible settings panel (right, 7 tabs). Editor panel slides up from bottom.

### New Design
Four resizable panes in a 2x2 grid, each with its own tab strip:

```
┌─────────────────────┬──────────────────────┐
│                     │                      │
│   Claude Chat       │   Architecture /     │
│   (session tabs)    │   Graph / Preview    │
│                     │                      │
├─────────────────────┼──────────────────────┤
│                     │                      │
│   Context Controls  │   Activity /         │
│   (skills, repos,   │   Deep Dive          │
│    tokens, files)   │   (audit, decisions, │
│                     │    console, events)  │
└─────────────────────┴──────────────────────┘
```

**Default proportions:** 55%/45% horizontal, 60%/40% vertical (chat gets more space).

### Top Left — Claude Chat
- Session tabs across the top (existing SessionTabs component)
- Full conversation with rich cards (existing: Outcome, Error, Decision, Preview, TestDetail, Activity, CodeBlock)
- Message input at bottom
- Switching session tabs updates ALL four quadrants to that session's state

### Top Right — Architecture / Visuals
Tabbed views:
- **Architecture** (default) — live diagram, see Section 3
- **Graph** — full D3 knowledge graph (existing KnowledgeGraph component, promoted from settings tab)
- **Preview** — dev server iframe preview (existing InlinePreviewCard, promoted to its own tab)

### Bottom Left — Context Controls
Tabbed views (migrated from current 7-tab settings panel):
- **Skills** — checkbox list with token cost per skill, toggle in/out of context instantly
- **Repos** — repository list with activation toggles (existing RepoManager)
- **Tokens** — budget management with visual bars (existing TokenControlPanel)
- **Files** — workspace file tree (existing WorkspaceTree)

### Bottom Right — Activity / Deep Dive
Tabbed views:
- **Audit** — event log with action types (existing AuditLog)
- **Decisions** — decision history with confidence scores (existing DecisionLog)
- **Console** — Python REPL (existing Console)
- **Events** — agent event stream (existing AgentStream)

### Pane Interactions
- **Drag dividers** between any quadrant to resize
- **Double-click a pane's tab bar** to maximize it full-screen; press Esc to restore
- **Ctrl+1/2/3/4** to focus a specific quadrant
- **Right-click pane tab bar → "Pin pane"** to prevent it from updating on session switch
- **Ctrl+Shift+C** continues to open the Monaco editor overlay (existing behavior)

## 3. Architecture Diagram — Zoom Levels

### Level 1 — Repo Topology (default)
High-level view showing all repos/services in the session's context:

- One box per repo/service with label, framework, and quick stats (route count, component count, export count)
- Connection lines between repos: solid for imports/dependencies, dashed for API calls
- **Color-coded borders:** blue (active session is working here), green (recently changed), gray (idle)
- **Pulse animation** on nodes the active session is currently touching
- Click any repo node to drill into Level 2

### Level 2 — Module Detail
Zoomed into one repo's internal structure:

- Boxes for each directory/module within the repo
- Dependency arrows between modules
- Test status per module (pass/fail count, colored indicator)
- Recently changed files highlighted with a brief flash animation
- **Breadcrumb navigation** at top to return to Level 1 (e.g., "All Repos > api-server")

### Real-Time Updates
- Architecture diagram re-renders as Claude edits files
- When a file is edited, its parent module node briefly flashes
- When a new dependency is added, the connection arrow animates in
- Data source: existing SurrealDB graph indexer, extended with file-watcher triggers from the `notify` crate watcher already in the backend

## 4. Independent Sessions

Each session is a fully independent context with its own:
- Active repo set
- Skill selections (checkbox state)
- Token budget and cost tracking
- Architecture view (filtered to session's repos)
- Audit trail and decision history
- Chat conversation

### Session Switching Behavior
When the user clicks a different session tab in the chat pane, **all four quadrants update simultaneously** to reflect that session's state. This is the default behavior.

**Pin override:** Users can right-click any pane's tab bar and select "Pin pane" to freeze that pane's content across session switches. Useful for comparing architecture across sessions or watching a shared audit log.

### Session Creation
Sessions can be created from:
- The "+" button in the chat pane's session tab bar
- The "+ New session" link on home screen project cards
- Each new session inherits the project's repo set by default but starts with no skills selected, allowing the user to compose context for the task at hand

## 5. Cost & Token Display

**Lead with cost, tokens in parentheses.** Displayed at three levels:

| Location | Format | Scope |
|----------|--------|-------|
| Title bar | `$0.38 (42.1k tokens)` | Current session |
| Status bar | `12m · $0.38 (42.1k tokens)` | Current session + elapsed time |
| Home screen cards | `$1.24 today` | Aggregated per project per day |
| Context controls budget bar | `$0.38 (42.1k tok)` with visual progress bar | Current session budget utilization |

## 6. What Changes vs. What's Preserved

### Replaces
- Two-column layout (chat + right sidebar) → quadrant grid
- 7-tab settings panel in one sidebar → distributed across bottom-left (context) and bottom-right (activity) quadrants
- Knowledge graph buried in settings tab → promoted to Architecture pane tab
- Static project cards → living cards with session list and cost

### Preserves
- All 7 existing rich conversation card types (Outcome, Error, Decision, Preview, TestDetail, Activity, CodeBlock)
- Monaco editor overlay (Ctrl+Shift+C)
- Custom title bar and status bar (updated with cost display)
- All 16 Zustand store slices (extended, not replaced)
- All 66+ Tauri commands (new commands added for session-scoped context)
- SurrealDB graph database (now powers the architecture view)
- D3 graph visualization (moved from settings tab to Architecture pane)
- Dark theme and existing design token system

### New Components Required
- `QuadrantLayout.tsx` — replaces MainLayout, manages 2x2 resizable grid
- `ArchitectureDiagram.tsx` — new SVG/D3 component for repo topology and module detail views
- `ArchitectureBreadcrumb.tsx` — navigation for zoom level transitions
- `EnhancedProjectCard.tsx` — extends ProjectCard with session list, cost, direct session launch
- `PaneHeader.tsx` — extends PanelHeader with pin/maximize/focus interactions

### Backend Changes Required
- Session-scoped context state (skills, repos per session) — extends `sessionSlice` and `claude_sessions` table
- Architecture data aggregation query — new SurrealDB composite query combining repo nodes, module nodes, and edge relationships
- Real-time graph update triggers — extend existing file watcher to re-index changed files into the graph
- Cost tracking — new field on session records, calculated from token usage

## 7. Implementation Considerations

### Layout Library
The existing `react-resizable-panels` dependency (v4.8.0) supports nested panel groups, which is exactly what the quadrant layout needs — a vertical split containing two horizontal splits.

### Architecture Diagram Rendering
D3.js is already a dependency (v7.9.0). The architecture diagram can use a force-directed layout for Level 1 (repo topology) and a hierarchical/tree layout for Level 2 (module detail). The existing `KnowledgeGraph.tsx` component provides patterns for D3 + React integration.

### Performance
- Architecture diagram should debounce updates (200-300ms) to avoid constant re-renders during active Claude sessions
- Session state switching should be instant — all session data is already in Zustand, just needs per-session keying
- Graph queries should be cached and invalidated on file change events

### Minimum Viable Implementation Order
1. Quadrant layout (structural change, unblocks everything)
2. Session-scoped context state (backend + store changes)
3. Context controls pane (migrate existing settings tabs)
4. Activity pane (migrate existing audit/decision/event tabs)
5. Architecture diagram Level 1 (new component, repo topology)
6. Architecture diagram Level 2 (module drill-down)
7. Enhanced home screen cards
8. Cost tracking display
