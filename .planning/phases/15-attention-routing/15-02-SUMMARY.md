---
phase: 15
plan: 02
subsystem: attention-routing
tags: [attention, title-bar, auto-scroll, ux]
dependency-graph:
  requires: [15-01]
  provides: [attention-badge, attention-scroll]
  affects: [TitleBar, ClaudeChat]
tech-stack:
  added: []
  patterns: [attention-derivation, cycle-navigation, scroll-to-element]
key-files:
  created:
    - src/lib/attention.ts
  modified:
    - src/components/layout/TitleBar.tsx
    - src/components/panels/ClaudeChat.tsx
decisions:
  - Attention badge renders unconditionally outside isHome gate for global visibility
  - Cycle index resets when attention count changes to avoid stale index
  - attentionScrollDone ref prevents re-scrolling same message on re-renders
  - clearSessionAttention called on send to immediately clear attention state
metrics:
  duration: 2m 46s
  completed: 2026-03-29
---

# Phase 15 Plan 02: Title Bar Attention Count + Auto-Scroll Summary

Global attention badge with click-to-cycle navigation and auto-scroll to flagged messages with orange ring highlight.

## What Was Built

### Task 1: Attention derivation utility (src/lib/attention.ts)
Pure function `getAttentionItems` that scans projects against session state to find those with `needs-input` or `error` status. Returns typed `AttentionItem[]` with project context, preview text, and messageId for scroll targeting.

### Task 2: TitleBar attention badge
Added Bell icon badge showing "N needs you" that appears when any project needs attention. Renders unconditionally (works on both home and conversation views). Click handler cycles through flagged projects calling both `openProject` and `setActiveClaudeSessionId` (plus `openWorkspace` in background). Cycle index resets when attention count changes.

### Task 3: Auto-scroll to attention message in ClaudeChat
When a session has an `attentionMessageId`, the chat auto-scrolls to that message with `scrollIntoView({ behavior: "smooth", block: "center" })` and applies a 2-second orange ring highlight. Uses a ref-based guard (`attentionScrollDone`) to prevent re-scrolling, reset when switching sessions. Also clears attention via `clearSessionAttention` when the user sends a message.

### Task 4: Verified attention clearing paths
Confirmed `setActiveClaudeSessionId` in agentSlice clears `needsInput`, `attentionPreview`, and `attentionMessageId` (added in Plan 01). Three clearing paths verified:
1. Home screen card click -> openProject + setActiveClaudeSessionId
2. Title bar badge click -> same flow
3. User sends message -> clearSessionAttention called in handleSend

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 3deb83b | feat(15-02): add title bar attention badge and auto-scroll to flagged messages |

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| src/lib/attention.ts | Created | AttentionItem interface + getAttentionItems derivation |
| src/components/layout/TitleBar.tsx | Modified | Attention badge, cycle handler, expanded store selector |
| src/components/panels/ClaudeChat.tsx | Modified | Auto-scroll effect, attention message ID wrapping, clear on send |

## Self-Check: PASSED

- [x] src/lib/attention.ts exists
- [x] src/components/layout/TitleBar.tsx exists
- [x] src/components/panels/ClaudeChat.tsx exists
- [x] Commit 3deb83b verified in git log
