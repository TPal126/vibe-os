# VIBE OS: README Feature Descriptions & Test Plan

## Overview

**Goal**: Rewrite the README feature descriptions for a user-facing audience ("what can I do with this"), then back every claimed feature with automated tests so nothing is sold that doesn't work.

**Approach**: README-first, then test suite as proof. Define the product story, then write tests that verify each claim. Any failing test reveals a gap to fix before shipping the README.

**Audience**: Potential users/developers who'd install and use VIBE OS.

**Known gap**: Knowledge Graph auto-indexing is not wired into the workflow. Must be fixed before the graph feature can be claimed in the README.

---

## Feature Hierarchy

6 top-level features, grouped by user value:

| # | Feature | One-Line Sell |
|---|---------|---------------|
| 1 | Multi-Project Dashboard | Home screen with live project cards -- status, outcomes, attention flags, preview thumbnails |
| 2 | Conversation-First IDE | Full-width Claude chat with inline activity, outcome, error, decision, and test cards |
| 3 | Multi-Session Agents | Run concurrent Claude Code sessions per project with tab switching and input-needed alerts |
| 4 | Knowledge Graph | Embedded SurrealDB graph auto-indexes code entities and traces decisions, provenance, and impact |
| 5 | Visibility & Audit | Decision log with confidence/impact scoring, append-only audit trail, JSON/CSV export |
| 6 | Context Control | Workspace system, repo/skill management, per-scope token budgets, Monaco editor escape hatch |

---

## README Feature Copy

### 1. Multi-Project Dashboard

The home screen shows every project as a card with live status. Each card surfaces what matters: is Claude working, idle, or waiting for you? How did the last run end -- tests passing, build errors, preview running? Projects that need your attention pulse orange with a count badge in the title bar. Click a card to enter its conversation. OS-level desktop notifications fire when a background session needs input.

### 2. Conversation-First IDE

Every interaction happens through a full-width chat. No column clutter -- just you and Claude. Agent activity streams into the conversation as typed inline cards: file creates and modifications, test results with pass/fail breakdowns, architectural decisions with confidence scores, errors with retry buttons, and live preview thumbnails when a dev server spins up. Code blocks collapse to a one-line summary with language and line count -- expand inline or open in the editor.

### 3. Multi-Session Agents

Run multiple Claude Code sessions simultaneously, each in its own subprocess with independent conversation history. Switch between sessions via tabs. Background sessions that need input surface through attention routing -- pulsing tab indicators, project card badges, and OS notifications so nothing blocks silently.

### 4. Knowledge Graph

An embedded SurrealDB graph database auto-indexes your code (repos, modules, functions, classes) and connects them to every decision, action, test, and skill from your sessions. Ask questions like "what decisions touched this function?" or "what breaks if I change this module?" through provenance and impact queries. An interactive D3 force-directed visualizer lets you filter by node type, search, and click-to-inspect.

### 5. Visibility & Audit

Every architectural decision is captured with rationale, confidence score, impact category, and reversibility. Every agent action -- file creates, test runs, prompts sent -- lands in an append-only audit log that is never deleted. Both are exportable to JSON or CSV.

### 6. Context Control

Workspaces organize repos, skills, and docs into a single directory with a CLAUDE.md that serves as the live-reloading system prompt. Toggle repos and skills on/off to control what context Claude sees. Set token budgets per skill, per repo, or per session with color-coded warnings. When you need to touch code directly, `Ctrl+Shift+C` opens a bottom Monaco editor panel -- code blocks in chat have a "View Code" button that opens them there.

---

## Test Plan

### Existing Coverage (keep as-is)

- **eventParser.test.ts** (23 tests): Type guards, code block extraction, session ID extraction, input request detection
- **agentSlice.test.ts** (20 tests): Session lifecycle, chat message accumulation, duplication prevention, status derivation

### New Tests by Feature

#### 1. Multi-Project Dashboard

| Test | Type | What It Proves |
|------|------|----------------|
| Project CRUD -- create, read, update, delete projects in store | Unit (Vitest) | projectSlice manages lifecycle correctly |
| Max 5 project enforcement | Unit (Vitest) | Store rejects 6th project |
| Status derivation from agent events (idle/working/needs-input/error/done) | Unit (Vitest) | Cards show correct status for each event type |
| Attention flag sets on input-needed event, clears on send | Unit (Vitest) | Attention routing logic works |
| Attention count aggregation across projects | Unit (Vitest) | Title bar badge math is correct |
| Preview URL extraction from agent events | Unit (Vitest) | PreviewThumbnail gets the right URL |
| Notification fires on input-needed event | Unit (Vitest) | useNotifications hook triggers correctly |

#### 2. Conversation-First IDE

| Test | Type | What It Proves |
|------|------|----------------|
| ActivityLine renders file ops with correct types | Unit (Vitest) | Card shows "Created src/foo.ts" not raw JSON |
| OutcomeCard renders test counts, build status, file list | Unit (Vitest) | Outcome summary is accurate |
| ErrorCard renders message and retry triggers re-send | Unit (Vitest) | Error flow works end-to-end |
| InlineDecisionCard renders confidence, impact, rationale | Unit (Vitest) | Decision metadata displays correctly |
| TestDetailCard renders pass/fail with test names | Unit (Vitest) | Test result parsing and display |
| CodeBlockSummary collapses with language + line count | Unit (Vitest) | Collapse/expand toggle works |
| Chat message accumulation without duplication | Unit (Vitest) | Already exists -- keep and extend |
| Rich card insertion into chat message stream | Unit (Vitest) | insertRichCard places cards in correct order |

#### 3. Multi-Session Agents

| Test | Type | What It Proves |
|------|------|----------------|
| Create/switch/remove Claude sessions in agentSlice | Unit (Vitest) | Session lifecycle in store |
| Events route to correct session by claude_session_id | Unit (Vitest) | No cross-session bleed |
| Session status independent per session | Unit (Vitest) | One errored session doesn't pollute another |
| start_claude spawns subprocess, returns session ID | Rust (Cargo) | CLI actually launches |
| send_message routes to correct running process | Rust (Cargo) | Follow-up messages hit right session |
| cancel_claude terminates the correct process | Rust (Cargo) | Kill doesn't hit wrong session |
| Claude CLI validation (validate_claude_cli) | Rust (Cargo) | Detects presence/absence of CLI |

#### 4. Knowledge Graph

| Test | Type | What It Proves |
|------|------|----------------|
| Schema creation succeeds (all 11 node + 16 edge tables) | Rust (Cargo) | SurrealDB schema is valid |
| Node CRUD -- create, read, upsert, list, delete | Rust (Cargo) | Basic graph operations work |
| Edge creation (graph_relate) and retrieval | Rust (Cargo) | Relationships persist correctly |
| Repo indexing extracts modules, functions, classes | Rust (Cargo) | Indexer produces real nodes from code |
| Auto-index triggers on code creation events | Rust (Cargo) | **New feature -- gap fix** |
| Provenance query traces backward from a node | Rust (Cargo) | "What led to this?" works |
| Impact query traces forward from a node | Rust (Cargo) | "What breaks if I change this?" works |
| Session report aggregates decisions/actions/tests | Rust (Cargo) | Full session lineage |
| Search returns matching nodes across all types | Rust (Cargo) | Full-text search works |
| Population pipeline (decision/action/skill/session) | Rust (Cargo) | Events create graph nodes+edges |
| D3 visualizer receives and renders graph data | Unit (Vitest) | Component calls graph_get_full, processes response |

#### 5. Visibility & Audit

| Test | Type | What It Proves |
|------|------|----------------|
| record_decision persists all fields | Rust (Cargo) | Decision metadata round-trips |
| get_session_decisions returns correct session's records | Rust (Cargo) | No cross-session bleed |
| export_decisions produces valid JSON and CSV | Rust (Cargo) | Export format is correct |
| log_action appends to audit log | Rust (Cargo) | Append-only behavior |
| get_audit_log respects limit parameter | Rust (Cargo) | Pagination works |
| export_audit_log produces valid JSON and CSV | Rust (Cargo) | Export format is correct |
| DecisionLog component loads and renders decisions | Unit (Vitest) | UI wiring works |
| AuditLog component loads and renders entries | Unit (Vitest) | UI wiring works |

#### 6. Context Control

| Test | Type | What It Proves |
|------|------|----------------|
| create_workspace scaffolds correct directory structure | Rust (Cargo) | Workspace dirs exist |
| open_workspace reads metadata, counts repos/skills | Rust (Cargo) | Metadata is accurate |
| watch_workspace_claude_md emits events on file change | Rust (Cargo) | Live-reload works |
| Repo add/toggle/list in repoSlice | Unit (Vitest) | Repo state management |
| Skill discover/toggle in skillSlice | Unit (Vitest) | Skill state management |
| compose_prompt respects token budgets | Rust (Cargo) | Budget enforcement |
| set/get/delete token budgets | Rust (Cargo) | Budget CRUD |
| Token warning thresholds trigger correct color state | Unit (Vitest) | UI shows green/orange/red correctly |
| Editor panel toggle state (Ctrl+Shift+C) | Unit (Vitest) | Layout slice toggles correctly |
| File open from workspace tree sets editor state | Unit (Vitest) | Click-to-edit flow |

---

## Test Totals

| Category | Existing | New | Total |
|----------|----------|-----|-------|
| Vitest (frontend) | 43 | 31 | 74 |
| Cargo (Rust backend) | ~5 | 27 | ~32 |
| **All** | **~48** | **58** | **~106** |

---

## Implementation Order

1. **Write README feature copy** (6 sections above)
2. **Write Vitest tests** for features 1-3 and 5-6 (31 tests)
3. **Write Cargo tests** for features 3-6 (27 tests, excluding graph auto-index)
4. **Fix Knowledge Graph auto-indexing gap** -- wire code creation events to trigger repo indexing
5. **Write graph auto-index test** (1 Cargo test proving the fix)
6. **Run full suite, fix any failures**
7. **Update README** with final test count and any copy adjustments from test findings

---

## New Feature: Knowledge Graph Auto-Indexing

**Current state**: Graph indexing only happens when user manually clicks "Index Repo" in the graph panel.

**Required change**: When a Claude session emits file creation or modification events (`file_create`, `file_modify` in `event_stream.rs`), automatically trigger `graph_index_repo` for the affected repository. This should be debounced (not on every single file event) and happen after the session completes or reaches a natural pause.

**Test**: After processing a simulated session with file creation events, verify that the graph contains nodes for the newly created code entities without any manual indexing step.
