# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Developers direct AI agents across multiple projects, see outcomes instead of code, and only engage when needed
**Current focus:** v3 Milestone -- Project Cards + Attention Routing, Phase 12 complete, Phase 13 next

## Current Position

Phase: 13 of 17 (Project Cards Home Screen)
Plan: 0/? (Not yet planned)
Status: Phase 12 complete. Ready to plan Phase 13.
Last activity: 2026-03-29 -- Phase 12 executed: 3/3 tasks, 3 files modified, 67/67 tests passing. Full-width chat layout live.

Progress: [=#--------] 17%

## v1 Summary

v1 completed 2026-03-29: 7 phases, 17 plans, 59 requirements, all delivered.

## v2 Summary

v2 completed 2026-03-29: 4 phases + post-phase fixes, 13 plans, 26 requirements, all delivered.
Post-phase: rewrote CLI integration, fixed infinite re-render, added 67 tests.

## Performance Metrics

**v1 Velocity:** 17 plans, ~5.4m avg, ~1.55 hours total
**v2 Velocity:** 13 plans, ~3.7m avg, ~48m total
**v3 Velocity:** 1 plan, ~2.5m, ~2.5m total

## Accumulated Context

### Decisions

- [v3 Roadmap]: Outcome over code -- users see running previews, test results, status cards, not diffs
- [v3 Roadmap]: Multi-project, not multi-session -- each lane is a whole application with its own workspace
- [v3 Roadmap]: Attention-driven UX -- app tells you when to engage, you don't monitor
- [v3 Roadmap]: Kill 3-column layout -- chat is 70%+ of screen, side panels are collapsible drawers
- [v3 Roadmap]: Code as escape hatch -- Show Code toggle for power users, hidden by default
- [v3 Roadmap]: Inline everything -- decisions, outcomes, agent activity appear in conversation flow
- [Phase 12]: Local-only project name editing -- editable input uses local useState, not wired to backend. Phase 13 adds persistence.
- [Phase 12]: SecondaryDrawer preserved despite panel removal -- zero visual impact when closed, Phase 17 needs it

### Pending Todos

None.

### Blockers/Concerns

- [Phase 12, RESOLVED]: 3-column layout removal completed cleanly. All backend functionality preserved, 67/67 tests passing.
- [Phase 13, HIGH risk]: Inline live preview in chat requires iframe management within a scrolling conversation. Need to handle lifecycle (create/destroy) and security (sandboxing).
- [Phase 14, MEDIUM risk]: Multi-project means multiple simultaneous Claude CLI subprocesses with independent state. The backend already supports this (ClaudeProcesses map), but the frontend project-switching UX is new.
- [Phase 15, LOW risk]: OS-level notifications require Tauri notification plugin. Need to add dependency.

## Session Continuity

Last session: 2026-03-29
Stopped at: Completed Phase 12 (Strip to Single-Project Chat). 3/3 tasks, 67/67 tests. Ready to plan Phase 13 (Project Cards Home Screen).
Resume file: None
