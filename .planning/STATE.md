# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Developers direct AI agents across multiple projects, see outcomes instead of code, and only engage when needed
**Current focus:** v3 Milestone -- Project Cards + Attention Routing, Phase 12 complete, Phase 13 next

## Current Position

Phase: 16 of 17 (Outcome Previews)
Plan: 3/3 complete
Status: Phase 16 complete. All 3 plans delivered: detection pipeline, card outcome display, inline conversation previews.
Last activity: 2026-03-29 -- Phase 16 Plan 03 executed: InlinePreviewCard and TestDetailCard components, test name parsing, card insertion wiring in ClaudeChat.

Progress: [=========#] 56%

## v1 Summary

v1 completed 2026-03-29: 7 phases, 17 plans, 59 requirements, all delivered.

## v2 Summary

v2 completed 2026-03-29: 4 phases + post-phase fixes, 13 plans, 26 requirements, all delivered.
Post-phase: rewrote CLI integration, fixed infinite re-render, added 67 tests.

## Performance Metrics

**v1 Velocity:** 17 plans, ~5.4m avg, ~1.55 hours total
**v2 Velocity:** 13 plans, ~3.7m avg, ~48m total
**v3 Velocity:** 9 plans, ~2.7m avg, ~23.9m total

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
- [Phase 14-01]: Activity lines replace static Working indicator with real tool detail via card type dispatch
- [Phase 14-01]: summarizeActivity uses category buckets for human-readable summaries
- [Phase 14-01]: currentActivityMessageId tracks open activity line per session, finalized on text or done/cancelled
- [Phase 14-02]: OutcomeCard only shown when files changed or tests run, skipped for simple Q&A
- [Phase 14-02]: ErrorCard retry reads store directly for last user message, calls sendMessage with conversationId
- [Phase 14-02]: Error card inserted BEFORE setSessionError to preserve status derivation ordering
- [Phase 14-03]: InlineDecisionCard uses same color system as DecisionLog panel for visual consistency
- [Phase 14-03]: Decision events forward-compatible: card renders when Rust parser emits decision events in future
- [Phase 15-01]: Attention preview captured from last assistant message first line, truncated to 80 chars
- [Phase 15-01]: clearSessionAttention also clears needsInput for clean status derivation
- [Phase 15-01]: Error attention captured after insertRichCard but before setSessionError for correct card ID
- [Phase 15-01]: StatusIcon rendered via dynamic component pattern for done/error/needs-input states
- [Phase 15-02]: Attention badge renders unconditionally outside isHome gate for global visibility
- [Phase 15-02]: Cycle index resets when attention count changes to avoid stale index
- [Phase 15-02]: attentionScrollDone ref prevents re-scrolling same message on re-renders
- [Phase 15-02]: clearSessionAttention called on send to immediately clear attention state
- [Phase 15-03]: Single-arg subscribe with ref-based previous state tracking (store lacks subscribeWithSelector)
- [Phase 15-03]: Dynamic import for notification plugin to avoid crashes in test/non-Tauri environments
- [Phase 15-03]: Deduplication via notifiedRef Set with cleanup when attention clears
- [Phase 16-01]: Detection helpers (extractDevServerUrl, parseTestResults, classifyBashCommand) are pure functions at module scope for testability
- [Phase 16-01]: First URL wins for previewUrl -- user can override via manual entry in Plan 02
- [Phase 16-02]: PreviewThumbnail uses React.memo to prevent unnecessary iframe reloads on parent re-renders
- [Phase 16-02]: Outcome section conditionally renders only when data present -- cards without outcomes stay compact

### Pending Todos

None.

### Blockers/Concerns

- [Phase 12, RESOLVED]: 3-column layout removal completed cleanly. All backend functionality preserved, 67/67 tests passing.
- [Phase 13, HIGH risk]: Inline live preview in chat requires iframe management within a scrolling conversation. Need to handle lifecycle (create/destroy) and security (sandboxing).
- [Phase 14, MEDIUM risk]: Multi-project means multiple simultaneous Claude CLI subprocesses with independent state. The backend already supports this (ClaudeProcesses map), but the frontend project-switching UX is new.
- [Phase 15, LOW risk]: OS-level notifications require Tauri notification plugin. Need to add dependency.

## Session Continuity

Last session: 2026-03-29
Stopped at: Completed 16-03-PLAN.md (Inline Conversation Previews + Test Details). 8/8 tasks. Phase 16 complete. Ready for Phase 17.
Resume file: None
