# Roadmap: VIBE OS

## Overview

VIBE OS v2 ("Workspace-First Vibe Coding Overhaul") restructures the application from a code-editor-centric IDE into a conversation-first vibe coding tool. The workspace system provides project-scoped context management. Claude Chat moves to center stage as the primary interaction surface. Secondary panels (editor, console, preview, diff) step back into an on-demand drawer. Multi-session support and direct token control give power users fine-grained command over their AI coding workflow. Phases 1-7 (v1) are complete; v2 begins at Phase 8.

## Milestone: v1 (Complete)

- [x] **Phase 1: Foundation** - Tauri v2 scaffold, Tailwind v4 CSS config, SQLite with WAL mode, shell plugin validation, production build proof
- [x] **Phase 2: Layout Shell** - Three-column resizable layout, custom title bar, status bar, shared components, dark theme, typography
- [x] **Phase 3: Context Assembly** - Repo manager, skills panel, prompt composer, prompt layer display, token budget bar
- [x] **Phase 4: Python REPL + Monaco Editor** - Python subprocess via shell plugin, console panel, Monaco editor with custom theme, file tabs, save-to-disk
- [x] **Phase 5: Agent Integration** - Claude CLI subprocess, event stream parser, chat panel with streaming, agent event display, working indicator
- [x] **Phase 6: Decisions, Audit & Scripts** - Micro-decision log, append-only audit trail, decision/audit export, scripts tracker, skills feedback loop
- [x] **Phase 7: Visualization, Diff & Polish** - Architecture D3 graph, live preview panel, diff view with accept/reject, status bar live data, keyboard shortcuts

## Milestone: v2 -- Workspace-First Vibe Coding Overhaul

## Phases

- [ ] **Phase 8: Workspace System** - Workspace directory CRUD, scaffolding, CLAUDE.md as system prompt, workspace file tree, repo/skill workspace integration
- [ ] **Phase 9: Layout Restructure & Dashboard** - Chat centered, session dashboard, decisions anchored right, Mermaid diagram, secondary panel drawer, workspace tree in left column
- [ ] **Phase 10: Multi-Session & Token Control** - Multiple Claude sessions with visual switcher, input-needed alerts, direct token control panel with fine-grained budgets
- [ ] **Phase 11: Polish & Bug Fixes** - Checkbox persistence fix, D3 removal/cleanup, deprecated layout code removal, status bar updates for v2

## Phase Details

### Phase 8: Workspace System
**Goal**: Users can create and open workspace directories that organize all project context -- repos, skills, docs, and a CLAUDE.md system prompt -- into a single, browsable location that replaces ad-hoc context management
**Depends on**: Phase 7 (v1 complete)
**Requirements**: WS-01, WS-02, WS-03, WS-04, WS-05, WS-06, WS-07
**Success Criteria** (what must be TRUE):
  1. User can create a new workspace by name; the app scaffolds ~/vibe-workspaces/{name}/ with CLAUDE.md, docs/, repos/, skills/, data/, and output/ directories, then opens it as the active workspace
  2. User can open an existing workspace directory; the app reads its CLAUDE.md as the system prompt, discovers skills in workspace/skills/, and lists repos in workspace/repos/
  3. Editing the workspace's CLAUDE.md file updates the system prompt that gets sent to Claude (no separate editable textarea)
  4. Workspace file tree component shows the workspace directory contents with expandable folders and file icons; clicking a file opens it in the editor
  5. Skills in workspace/skills/ appear alongside global skills, with workspace-local skills winning on name conflicts; repos clone into workspace/repos/
**Plans**: 3 plans
Plans:
- [x] 08-01-PLAN.md -- Workspace backend: Rust commands for scaffold, open, read tree, watch CLAUDE.md, modified clone_repo/discover_skills
- [x] 08-02-PLAN.md -- Workspace frontend state: Zustand slice, tauri command wrappers, watcher hook, modified repo/skill slices, app init
- [ ] 08-03-PLAN.md -- Workspace UI: file tree component, create workspace modal, title bar controls, layout integration

### Phase 9: Layout Restructure & Dashboard
**Goal**: Users experience a conversation-first interface where Claude Chat dominates the center, a session dashboard provides at-a-glance context, decisions are anchored right with Mermaid architecture below, and secondary panels move to a drawer -- completing the visual overhaul
**Depends on**: Phase 8
**Requirements**: LAYOUT-09, LAYOUT-10, LAYOUT-11, LAYOUT-12, LAYOUT-13, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, ARCH-01, ARCH-02, ARCH-03
**Success Criteria** (what must be TRUE):
  1. Claude Chat occupies the center column top (60-70% height) as the primary interaction surface; the Session Dashboard occupies the center column bottom (30-40%) showing current goal, context summary, activity feed, and session stats
  2. Left column top has Repos, Skills, and Token Control as tabs; left column bottom has the Workspace File Tree (from Phase 8)
  3. Right column top shows Decisions panel by default with Agent Stream and Audit Log as clickable alternatives; right column bottom renders a Mermaid architecture diagram generated from codebase analysis
  4. Editor, Console, Preview, and Diff are accessible via a toggleable drawer or overlay that slides in from the bottom or side -- not permanently visible in the three-column layout
  5. Scripts Tracker is no longer a standalone panel; its functionality is absorbed into the workspace file tree (output/ directory) or available through the secondary drawer
**Plans**: 3 plans
Plans:
- [x] 09-01-PLAN.md -- Layout restructure with new column assignments, secondary drawer, layout state slice
- [ ] 09-02-PLAN.md -- Session Dashboard with editable goal, context summary, activity feed, session stats
- [ ] 09-03-PLAN.md -- Mermaid architecture diagram, ArchGraph converter, D3 removal

### Phase 10: Multi-Session & Token Control
**Goal**: Power users can run multiple Claude sessions simultaneously with clear visual management, get alerted when a background session needs input, and control token budgets with fine-grained per-skill and per-repo limits
**Depends on**: Phase 9
**Requirements**: CHAT-01, CHAT-02, CHAT-03, TOKEN-01, TOKEN-02
**Success Criteria** (what must be TRUE):
  1. User can start multiple Claude Code sessions; each session has its own subprocess, conversation history, and working/idle state tracked independently
  2. Session tabs in the chat area show all active sessions with visual distinction for the currently viewed session; clicking a tab switches the chat view to that session's history
  3. When a non-active session requires user input, a visual alert (pulsing dot, badge count, or notification) appears on its tab so the user can respond without constantly checking
  4. Token Control panel (left column tab) lets the user set per-skill token limits, per-repo context limits, and an overall session budget; approaching or exceeding limits shows color-coded warnings
**Plans**: 3 plans
Plans:
- [ ] 10-01-PLAN.md -- Multi-session backend: claude_sessions DB table, session-tagged events, process tracking per session, CRUD commands
- [ ] 10-02-PLAN.md -- Multi-session frontend: per-session AgentSlice, SessionTabs component, input-needed alerts, useClaudeStream routing
- [ ] 10-03-PLAN.md -- Token Control: token_budgets DB table, TokenControlPanel UI, per-skill/per-repo/session budgets, compose_prompt enforcement

### Phase 11: Polish & Bug Fixes
**Goal**: All rough edges from the v2 overhaul are cleaned up -- toggle state bugs fixed, deprecated v1 code removed, status bar updated for the new layout, and the overall experience is cohesive
**Depends on**: Phase 9, Phase 10
**Requirements**: BUG-01, BUG-02
**Success Criteria** (what must be TRUE):
  1. Repo and skill checkbox toggle states persist correctly when navigating between tabs in the left column -- toggling a repo, switching to Skills tab, then switching back shows the repo still toggled
  2. D3 force graph component and its dependencies are fully removed or replaced; no dead D3 code remains in the codebase
  3. Status bar and title bar reflect v2 state: active workspace name, active Claude session count, workspace-relative paths where appropriate
  4. No v1 layout artifacts remain: the old center column (editor/preview/architecture tabs + console) and old left column (prompt layer tab + chat bottom) are fully replaced by the v2 layout
**Plans**:
  - 11-01: Checkbox Toggle Persistence Fix (BUG-01) -- Fix loadRepos/discoverSkills to preserve active state on tab switch
  - 11-02: Claude CLI Spawn Error Handling (BUG-02) -- Add pre-flight validation, actionable error messages with install instructions
  - 11-03: D3 Removal & V1 Dead Code Cleanup (ARCH-03, SC2, SC4) -- Delete ArchViewer, D3 deps, deprecated panels, v1 layout artifacts
  - 11-04: Status Bar & Title Bar v2 Updates (SC3) -- Workspace name, session count, workspace-relative paths

## Progress

**Execution Order:**
Phases execute in numeric order: 8 -> 9 -> 10 -> 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 8. Workspace System | 3/3 | Complete | 2026-03-28 |
| 9. Layout Restructure & Dashboard | 1/3 | In Progress | - |
| 10. Multi-Session & Token Control | 0/3 | Planned | - |
| 11. Polish & Bug Fixes | 0/4 | Planned | - |
