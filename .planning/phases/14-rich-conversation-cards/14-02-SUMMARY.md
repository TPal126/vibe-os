# Phase 14 Plan 02: Outcome Cards + Error Cards Summary

Structured outcome cards for task completion (green, expandable file list, cost/duration) and error cards with retry/details (red, store-driven retry via sendMessage)

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create OutcomeCard component | 1fd865a | src/components/conversation/OutcomeCard.tsx (new) |
| 2 | Create ErrorCard component | 1fd865a | src/components/conversation/ErrorCard.tsx (new) |
| 3 | Wire result events to OutcomeCard | 1fd865a | src/hooks/useClaudeStream.ts |
| 4 | Wire error events to ErrorCard | 1fd865a | src/hooks/useClaudeStream.ts |
| 5 | Update ClaudeChat rendering | 1fd865a | src/components/panels/ClaudeChat.tsx |

## What Was Built

### OutcomeCard (src/components/conversation/OutcomeCard.tsx)
- Collapsed: green CheckCircle + summary ("Changed 3 files, all tests passing") + expand chevron
- Expanded: file list with Created/Edited indicators, cost and duration display
- Reads cardData: filesCreated, filesEdited, testsRun, testsPassed, costUsd, durationMs
- React.memo for performance, same expand/collapse pattern as ActivityLine

### ErrorCard (src/components/conversation/ErrorCard.tsx)
- Default: red XCircle + error summary + Retry and Show Details buttons
- Show Details: full error text in monospace, max-height 200px with scroll
- Retry: reads store directly to find last user message, calls commands.sendMessage with conversationId
- Retry disabled when session isWorking or no previous user message exists
- Uses useAppStore subscription for live disable state

### Stream Wiring (src/hooks/useClaudeStream.ts)
- Result events: scans accumulated agentEvents for file_create, file_modify, test_run; creates outcome card if fileCount > 0 or testsRun > 0; skips for simple Q&A
- Error events: extracts first line as errorMessage, inserts error card BEFORE existing setSessionError/setAgentError calls (preserving status derivation)

### ClaudeChat Dispatch (src/components/panels/ClaudeChat.tsx)
- Switch statement now handles: activity, outcome, error, default (MessageBubble)
- Imported OutcomeCard and ErrorCard components

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript: `npx tsc --noEmit` passes (3 pre-existing warnings unrelated to this plan)
- Tests: 43/43 passing
- No Rust backend files modified
- addSessionAgentEvent still called for all events (audit trail preserved)
- setSessionError and setAgentError calls preserved in error handling

## Metrics

- Duration: ~2.7 minutes
- Tasks: 5/5
- Files created: 2 (OutcomeCard.tsx, ErrorCard.tsx)
- Files modified: 2 (useClaudeStream.ts, ClaudeChat.tsx)
- Lines added: ~269
