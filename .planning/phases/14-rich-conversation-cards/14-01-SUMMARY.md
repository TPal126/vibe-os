---
phase: 14
plan: 1
subsystem: conversation-cards
tags: [card-types, activity-lines, inline-status, zustand]
dependency-graph:
  requires: [phase-12-strip-layout, phase-13-project-cards]
  provides: [card-type-system, activity-line-component, activity-store-methods]
  affects: [useClaudeStream, ClaudeChat, agentSlice, types]
tech-stack:
  added: []
  patterns: [card-type-dispatch, activity-event-aggregation, inline-status-cards]
key-files:
  created:
    - src/components/conversation/ActivityLine.tsx
  modified:
    - src/stores/types.ts
    - src/stores/slices/agentSlice.ts
    - src/hooks/useClaudeStream.ts
    - src/components/panels/ClaudeChat.tsx
decisions:
  - Activity lines replace static Working indicator with real tool detail
  - summarizeActivity uses category buckets (reads, edits, creates, tests, commands) for human-readable summaries
  - currentActivityMessageId tracks open activity line per session, finalized on assistant text or done/cancelled
metrics:
  duration: 305s
  completed: 2026-03-29
  tasks: 5
  files: 5
---

# Phase 14 Plan 01: Card Type System + Inline Activity Lines Summary

Extended chat message model with card types and created inline activity lines showing real-time tool usage, replacing the generic Working indicator.

## One-liner

Card type system with CardType/ActivityEvent types, 3 new store methods, and collapsible ActivityLine component rendering tool activity inline in conversation flow.

## What Was Built

### Type Extensions (types.ts)
- `CardType` union: `"activity" | "outcome" | "error" | "decision"`
- `ActivityEvent` interface with type, content, tool, path, timestamp
- `cardType?` and `cardData?` optional fields on `ChatMessage`
- `currentActivityMessageId: string | null` on `ClaudeSessionState`
- 3 new methods on `AgentSlice`: `upsertActivityLine`, `finalizeActivityLine`, `insertRichCard`

### Store Methods (agentSlice.ts)
- `summarizeActivity()` helper: buckets events into reads/edits/creates/tests/commands, produces "Reading 3 files . Editing main.py . Running tests"
- `upsertActivityLine()`: creates or updates activity card message, tracks via `currentActivityMessageId`
- `finalizeActivityLine()`: clears `currentActivityMessageId` so next tool use gets a fresh card
- `insertRichCard()`: finalizes any open activity line, then creates a new card message of any type
- `clearSessionChat()` also clears `currentActivityMessageId`

### ActivityLine Component (NEW)
- Collapsible inline card: pulsing blue dot + summary text + chevron toggle
- Expanded state: individual event list (max 10, "+N more" overflow)
- `React.memo` for render performance
- Styled with `bg-v-surface/50 rounded px-3 py-1.5 my-1`, `text-[11px] text-v-dim font-mono`

### Stream Routing (useClaudeStream.ts)
- Tool events (`event.metadata?.tool`) trigger `upsertActivityLine()` after `addSessionAgentEvent()`
- `finalizeActivityLine()` called before `appendToSessionLastAssistant()` (assistant text)
- `finalizeActivityLine()` called on status "done" and "cancelled" before `setSessionWorking(false)`
- `addSessionAgentEvent()` still called for ALL events (audit trail preserved)

### Chat Rendering (ClaudeChat.tsx)
- Card type dispatch: `msg.cardType === "activity"` renders `<ActivityLine>`
- Static "Working..." indicator block removed entirely
- Unused `Dot` import removed

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1-2 | 7a4ac40 | Card type system and activity line store methods |
| 3 | 7397891 | ActivityLine conversation card component |
| 4 | 7bc9def | Tool event routing in useClaudeStream |
| 5 | b5986b2 | Inline rendering and Working indicator removal |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused Dot import from ClaudeChat**
- Found during: Task 5
- Issue: Removing the Working indicator left `Dot` as an unused import
- Fix: Removed the import line
- Files modified: src/components/panels/ClaudeChat.tsx

**2. [Rule 2 - Missing] Added currentActivityMessageId reset in clearSessionChat**
- Found during: Task 2
- Issue: `clearSessionChat` would leave a stale `currentActivityMessageId` reference
- Fix: Added `currentActivityMessageId: null` to the clear mutation
- Files modified: src/stores/slices/agentSlice.ts

## Verification

- TypeScript compiles with only pre-existing unused variable warnings (not from our changes)
- All 43 existing tests pass (2 test files)
- `addSessionAgentEvent` still called for all events (audit trail preserved)
- No Rust backend files modified
- No existing panel components deleted

## Self-Check: PASSED

All 5 created/modified files verified on disk. All 4 commit hashes verified in git log.
