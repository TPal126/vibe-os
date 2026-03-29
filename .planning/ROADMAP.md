# Roadmap: VIBE OS

## Overview

VIBE OS v3 ("Project Cards + Attention Routing") replaces the multi-panel IDE with a card-based interface. 3-5 project cards, each running an independent Claude agent. Cards show outcomes, not code. Cards pulse when they need you. Inspired by Gastown but focused on making 3-5 projects effortless instead of 30 possible.

## Milestone: v1 (Complete)

- [x] **Phase 1-7**: Full IDE with editor, console, agent integration, decisions, audit, D3 visualization

## Milestone: v2 (Complete)

- [x] **Phase 8-11 + Post-fixes**: Workspace system, conversation-first layout, multi-session, token control, Mermaid diagrams, 67 tests

## Milestone: v3 -- Project Cards + Attention Routing

## Phases

- [x] **Phase 12: Strip to Single-Project Chat** - Rip out 3-column layout. Replace with full-width chat for one project. Compact top bar with context badges and settings gear. This is the new foundation everything else builds on.
- [ ] **Phase 13: Project Cards Home Screen** - Add card grid as navigation layer above single-project view. Card shows name, status, one-line summary. New Project flow. Card-to-conversation routing. Max 5 cards.
- [ ] **Phase 14: Rich Conversation Cards** - Outcome cards (task complete, file summary), error cards (red, actionable, retry button), decision cards (inline, expandable), inline agent activity lines replacing the raw event stream panel.
- [ ] **Phase 15: Attention Routing** - Cards pulse when they need you. Global "N need you" in title bar. OS-level notifications via Tauri plugin. Auto-scroll to attention items. Attention clears on engagement.
- [ ] **Phase 16: Outcome Previews** - Live iframe thumbnails on cards for web apps. Test result badges. Build/deploy status lines. Inline expandable previews in conversation.
- [ ] **Phase 17: Settings & Escape Hatch** - Repo/skill/token management behind settings gear. Audit log in settings menu. Ctrl+Shift+C toggles Monaco editor for power users.

## Phase Details

### Phase 12: Strip to Single-Project Chat
**Goal**: One project, full-width chat, no panels. This is the "delete phase" — remove the 3-column layout, session dashboard, right column, and all visible panel chrome. What remains: a chat surface with a compact top bar.
**Depends on**: v2 complete
**Requirements**: CONV-01, CONV-02
**Success Criteria** (what must be TRUE):
  1. App opens to a full-width chat view (no left column, no right column, no session dashboard)
  2. Compact top bar shows: project name (editable), context summary badges ("2 repos · 3 skills · 8k tokens"), and a settings gear icon
  3. Chat input and message history work exactly as before (Claude CLI integration preserved)
  4. All v2 backend functionality preserved (workspaces, sessions, token budgets, audit) — only the visible layout changes
  5. All 67 existing tests pass
  6. Title bar simplified: branding + project name + window controls only

### Phase 13: Project Cards Home Screen
**Goal**: When you open the app, you see your projects as cards. Click one to enter its conversation. This is the navigation layer.
**Depends on**: Phase 12
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-04
**Success Criteria** (what must be TRUE):
  1. App opens to a card grid instead of directly into chat. Each card shows project name and status indicator (idle/working/needs-input/done/error)
  2. Clicking a card navigates to that project's conversation view (Phase 12). Back button returns to cards
  3. "New Project" card: enter name → workspace scaffolded → Claude session created → conversation view opens
  4. Each card persists independently: workspace path, Claude session ID, conversation history, active repos/skills
  5. Cards update in real-time as agents change status (working → done, idle → working)
  6. Max 5 project cards enforced. Card design is minimal: status color + name + one-line summary

### Phase 14: Rich Conversation Cards
**Goal**: The conversation becomes the only surface you need. Claude's actions, outcomes, errors, and decisions render as rich inline cards — not raw text, not separate panels.
**Depends on**: Phase 12
**Requirements**: CONV-03, CONV-04, CONV-05, CONV-06
**Success Criteria** (what must be TRUE):
  1. While Claude works, compact collapsible status lines appear inline: "Reading 3 files · Editing src/main.py · Running tests..."
  2. Task completion renders as an outcome card: "Changed 3 files, all tests passing" with expandable file list. No code by default
  3. Errors render as red-bordered cards with clear message + "Retry" / "Show Details" buttons. No raw stack traces
  4. Decisions render as expandable inline cards with rationale, confidence badge, and impact category color
  5. The agent event stream panel, decisions panel, and audit log panel are no longer visible in the main UI
  6. Raw agent events still logged to backend (audit trail preserved)

### Phase 15: Attention Routing
**Goal**: You leave the app running and go make coffee. When you come back, it says "2 need you" and takes you to exactly the right message.
**Depends on**: Phase 13, Phase 14
**Requirements**: ATTN-01, ATTN-02, ATTN-03, ATTN-04, ATTN-05
**Success Criteria** (what must be TRUE):
  1. When an agent needs input: its project card pulses orange with a one-line preview ("Needs decision: JWT vs session cookies?")
  2. When a project completes: green checkmark on card. When it fails: red X with error summary on card
  3. Title bar shows global attention count: "2 need you" — clickable to cycle through flagged projects
  4. OS-level system notifications fire for input-needed and error events (requires Tauri notification plugin)
  5. Opening a flagged project auto-scrolls to the message that needs response. Flag clears when user engages

### Phase 16: Outcome Previews
**Goal**: Project cards show what the project looks like. A web app card shows the running app. A test suite shows pass/fail. You see outcomes on the home screen without opening the conversation.
**Depends on**: Phase 14
**Requirements**: CARD-05, PREV-01, PREV-02, PREV-03
**Success Criteria** (what must be TRUE):
  1. When a project has a running dev server (URL detected from Claude output or user-configured), card shows a live iframe thumbnail
  2. Test results detected from agent events render as colored badge on card: green "8/8 passing" or red "3 failed"
  3. Build/deploy status shows as a status line on card: "Building..." / "Running at localhost:3000" / "Build failed"
  4. In conversation view, preview URLs expand to full-width inline iframes. Test detail cards expand to show individual test names

### Phase 17: Settings & Escape Hatch
**Goal**: All v2 power features still exist for users who want them. They're just not in your face.
**Depends on**: Phase 14
**Requirements**: SIMP-01, SIMP-02, SIMP-03
**Success Criteria** (what must be TRUE):
  1. Settings gear in conversation top bar opens a slide-in panel with: repo management, skill management, token budget controls, workspace file browser
  2. Audit log and full agent event history accessible from project settings menu
  3. Ctrl+Shift+C toggles a Monaco editor slide-in panel. Hidden by default. Shows files from workspace
  4. Code blocks in chat messages show outcome summaries by default ("Created src/main.py — 45 lines"). "View Code" button opens the editor escape hatch

## Progress

**Execution Order:**

```
12 (Strip layout) → 13 (Cards) → 15 (Attention)
                  → 14 (Rich cards) → 16 (Previews)
                                    → 17 (Settings)
```

Phase 12 is the foundation — everything depends on it.
Phases 13 and 14 can run in parallel after 12.
Phase 15 needs both 13 (cards exist) and 14 (conversation cards exist).
Phases 16 and 17 need 14 (conversation view is rich enough to be the only surface).

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 12. Strip to Single-Project Chat | 1/1 | Complete | 2026-03-29 |
| 13. Project Cards Home Screen | 3/3 | Complete | 2026-03-29 |
| 14. Rich Conversation Cards | 2/3 | In Progress | - |
| 15. Attention Routing | 0/? | Planned | - |
| 16. Outcome Previews | 0/? | Planned | - |
| 17. Settings & Escape Hatch | 0/? | Planned | - |
