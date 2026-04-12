# Multi-Backend Workflow Orchestrator

**Date:** 2026-04-12
**Status:** Draft
**Approach:** Layered Adapter + Workflow Engine (Option C)

## Overview

Expand vibe-os from a Claude Code-only cockpit to a multi-backend workflow orchestrator. Users define customizable pipelines of phases (ideation, planning, execution, verification, etc.), configure each phase with a backend (Claude CLI / Codex CLI), framework (Superpowers / GSD / Native / Custom), and model (Opus / Sonnet / GPT-4.1 / etc.), and run them with configurable gates between phases. Frameworks like Superpowers and GSD deliver their full interactive experience — visual companions, structured Q&A — through vibe-os's UI.

## Architecture: Layered Adapter + Workflow Engine

Two clean layers with separate concerns:

1. **Backend Adapter Layer** — thin trait for spawn/stream/cancel per CLI backend
2. **Workflow Engine** — pipeline orchestration, context handoff, framework interaction routing, gate management

Framework compatibility is data-driven (JSON manifests) for UI filtering and skill dispatch. Adding new framework+backend combos requires both a manifest update and adapter/integration work — the manifest drives what the UI shows, but backend enablement involves adapter code, prompt translation, stdin round-trip handling, and event parsing specific to that backend.

## Prerequisite: Agent Session Abstraction

Before implementing the adapter/workflow layers, the codebase needs a backend-agnostic session abstraction. Today the app is Claude-shaped throughout:

- **Rust:** `event_stream.rs` serializes `claude_session_id` on every event. `claude_commands.rs` owns process state as `ClaudeProcesses`.
- **Frontend types:** `ClaudeSessionState`, `claudeSessions`, `claudeCliAvailable`, `activeClaudeSessionId` in `AgentSlice` (types `src/stores/types.ts:311-348`).
- **Two competing stream paths:** `useClaudeStream` (disabled, CLI-based) and `useAgentStream` (active, SDK sidecar-based with `SdkAssistantMessage`/`SdkResultMessage` types). The spec's event normalization must account for *three* event shapes (Claude CLI stream-json, SDK sidecar agent-event, Codex CLI), not two.

**Required migration (before adapter work):**

1. Rename `ClaudeSessionState` → `AgentSessionState` with new field `backend: "claude" | "codex" | "sidecar"`
2. Rename `claudeSessions` → `agentSessions`, `activeClaudeSessionId` → `activeSessionId`, etc. across store types and slices
3. Rename `claude_session_id` → `agent_session_id` in Rust `AgentEvent` struct
4. Unify the Tauri event channel: both CLI adapters and the SDK sidecar emit on `"agent-stream"` with a discriminated `source` field
5. `useAgentStream` becomes the single listener that dispatches based on `source` (cli-claude, cli-codex, sdk-sidecar)

This is a prerequisite, not a parallel workstream — the adapter layer sits on top of this abstraction.

## Section 1: Backend Adapter Layer

### Rust trait (`src-tauri/src/backends/mod.rs`)

```rust
pub trait BackendAdapter: Send + Sync {
    fn name(&self) -> &str;                // "claude" | "codex"
    fn validate(&self) -> Result<CliInfo>; // check CLI exists, return version
    fn spawn(&self, args: SpawnArgs, app: &AppHandle) -> Result<String>; // returns session_id
    fn send_input(&self, session_id: &str, input: &str) -> Result<()>;
    fn cancel(&self, session_id: &str) -> Result<()>;
    fn supported_models(&self) -> Vec<ModelInfo>;
}
```

### SpawnArgs (backend-agnostic)

```rust
pub struct SpawnArgs {
    pub working_dir: String,
    pub message: String,
    pub system_prompt: Option<String>,
    pub session_id: String,
    pub model: String,                      // "opus", "sonnet", "gpt-4.1", etc.
    pub framework_context: Option<String>,  // injected by workflow engine
    pub resume_id: Option<String>,          // for continuing conversations
}
```

### ClaudeAdapter (`src-tauri/src/backends/claude.rs`)

Wraps existing `claude_commands.rs` logic:
- Spawns `claude -p --output-format stream-json --verbose`
- Parses stdout via existing `event_stream.rs`
- Emits normalized `AgentEvent`s on Tauri event channel `"agent-stream"`
- Manages child processes via existing `ClaudeProcesses` state

### CodexAdapter (`src-tauri/src/backends/codex.rs`)

New implementation:
- Spawns `codex --quiet` (or equivalent non-interactive mode)
- Parses Codex CLI output via new `codex_event_stream.rs`
- Emits the same normalized `AgentEvent`s on `"agent-stream"`
- Same process management pattern as ClaudeAdapter

### Key principle

Both adapters emit the same `AgentEvent` type. The frontend does not know or care which backend produced an event.

## Section 2: Workflow Engine + Framework Interaction

### Location: `src-tauri/src/workflow/`

### 2.1 Pipeline Orchestration

- Loads pipeline definitions from SQLite per-project
- Runs phases sequentially, respecting ordering
- At phase completion: stores artifact + summary, checks gate config
  - `gate_after = "auto"` → immediately starts next phase
  - `gate_after = "gated"` → emits `PhaseTransition` event, waits for user confirmation
- Passes context to next phase via `SpawnArgs.framework_context`

### 2.2 Framework Interaction Routing

When a backend emits events that require user interaction, the engine classifies and routes them:

| Event type | Source | Routing |
|---|---|---|
| **Question/prompt** | GSD asking clarifying questions, Superpowers asking design questions | → `InteractionCard` in conversation UI. User answers inline, answer routes to backend stdin |
| **Visual companion** | Superpowers brainstorming visual companion | → vibe-os manages companion server lifecycle. Shows "Companion active" indicator with URL. User opens in browser. Selections route back through engine |
| **Artifact output** | Plan docs, specs, verification reports | → Stored in `ArtifactStore`, shown as rich card in conversation |

### 2.3 Phase Lifecycle

```
Pending → Running → AwaitingInput → Running → Completed
                                                  ↓
                                      [if gated] → AwaitingGate → (user confirms) → next phase
                                      [if auto]  → next phase starts immediately
```

### 2.4 New AgentEvent Types

Added to the existing `AgentEvent` enum:

- `InteractionRequest` — framework needs user input (question text, options, input type)
- `VisualContent` — framework wants to show visual companion (URL to open)
- `ArtifactProduced` — phase produced a handoff artifact (path, type, summary)
- `PhaseTransition` — workflow moved to next phase or hit a gate

## Section 3: Workflow Builder UI

### Location in app

Part of project creation flow. When a user creates a new project on the Home view, the workflow builder is part of the setup — the pipeline is a first-class project property.

### Three-panel layout

**Left — Phase Palette:**
- Draggable phase cards: Ideation, Planning, Execution, Verification, Review, Custom
- User drags phases onto the canvas to build their pipeline

**Center — Pipeline Canvas:**
- Vertical flow of phases in order
- Each phase card shows its Backend / Framework / Model config as tags
- Phases are reorderable via drag-and-drop
- Connections between phases show gate status:
  - Amber dot = gated (user reviews before continuing)
  - Green dot = auto (flows directly)
- Click a connection to toggle gate behavior

**Right — Phase Config Panel:**
- Appears when a phase is selected on the canvas
- Three-level cascading selection:
  1. **Backend** — Claude / Codex (toggle buttons)
  2. **Framework** — options filtered by backend compatibility (Superpowers, GSD, Native, Custom). Incompatible options grayed out with explanation
  3. **Model** — options filtered by backend (Opus/Sonnet/Haiku for Claude, GPT-4.1/o3/o4-mini for Codex)
- Custom prompt textarea when framework = "Custom"

### Frontend components

- `components/home/WorkflowBuilder.tsx` — main builder container
- `components/home/PhasePalette.tsx` — draggable phase source
- `components/home/PipelineCanvas.tsx` — drop target, renders phase cards and connections
- `components/home/PhaseCard.tsx` — individual phase display with config summary
- `components/home/ConnectionEditor.tsx` — gate toggle on phase connections
- `components/home/PhaseConfigPanel.tsx` — three-level Backend/Framework/Model picker

### Conversation view additions

- `PhaseIndicator` in conversation header — shows current phase, progress through pipeline
- `InteractionCard` component — renders framework questions with answer buttons/input inline in chat
- "Companion active" indicator — shows URL when visual companion is running
- Gate prompt card — "Phase complete. Review artifact below. Continue to next phase?"

## Section 4: Data Model

### Project ownership

Today, projects live in Zustand state only (`Project` type with `claudeSessionId`, persisted via store). There is no SQLite `projects` table — the current DB (user_version = 8) has `sessions`, `settings`, `audit_log`, `decisions`, `claude_sessions`, `token_budgets`, `events`, and `repos`.

**Decision:** Add a `projects` table to SQLite as part of this work. Pipelines belong to projects. This also fixes the existing fragility of projects being Zustand-only state.

### SQLite tables (migration v9)

```sql
-- Projects (new — currently Zustand-only)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_path TEXT NOT NULL,
  summary TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Each project has one pipeline
CREATE TABLE IF NOT EXISTS pipeline (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT DEFAULT 'Default',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Ordered phases within a pipeline
CREATE TABLE IF NOT EXISTS pipeline_phase (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL REFERENCES pipeline(id),
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  phase_type TEXT NOT NULL,          -- ideation|planning|execution|verification|review|custom
  backend TEXT NOT NULL,             -- "claude" | "codex"
  framework TEXT NOT NULL,           -- "superpowers" | "gsd" | "native" | "custom"
  model TEXT NOT NULL,               -- "opus" | "sonnet" | "haiku" | "gpt-4.1" | "o3" | etc.
  custom_prompt TEXT,                -- user-provided system prompt when framework = "custom"
  gate_after TEXT DEFAULT 'gated'    -- "gated" | "auto"
);

-- A single execution of a pipeline (groups phase_runs)
CREATE TABLE IF NOT EXISTS pipeline_run (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL REFERENCES pipeline(id),
  status TEXT NOT NULL,              -- pending|running|paused|completed|failed
  started_at TEXT NOT NULL,
  completed_at TEXT
);

-- Phase execution state (belongs to a pipeline_run)
CREATE TABLE IF NOT EXISTS phase_run (
  id TEXT PRIMARY KEY,
  pipeline_run_id TEXT NOT NULL REFERENCES pipeline_run(id),
  phase_id TEXT NOT NULL REFERENCES pipeline_phase(id),
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,              -- pending|running|awaiting_input|awaiting_gate|completed|failed
  artifact_path TEXT,
  summary TEXT,
  baseline_sha TEXT,                 -- HEAD commit at phase start, for scoping diffs
  baseline_worktree_path TEXT,       -- path to worktree if isolation was used
  started_at TEXT,
  completed_at TEXT
);
```

**What `pipeline_run` gives us:**
- Multiple executions of the same pipeline are cleanly separated
- Artifacts stored under `.vibe-os/artifacts/{pipeline_run_id}/` now have an actual FK
- Resuming a halted run = find the `pipeline_run` with status `paused`, locate its last completed `phase_run`, continue from the next phase
- Phase summaries/artifacts are grouped under one attempt, not scattered

### Framework manifests (`src-tauri/frameworks/*.json`)

Each framework declares its capabilities as data:

```json
{
  "id": "superpowers",
  "name": "Superpowers",
  "supported_backends": ["claude"],
  "supported_phases": ["ideation", "planning", "execution", "verification", "review"],
  "features": {
    "visual_companion": true,
    "interactive_questions": true
  },
  "phase_skills": {
    "ideation": "superpowers:brainstorming",
    "planning": "superpowers:writing-plans",
    "execution": "superpowers:executing-plans",
    "verification": "superpowers:verification-before-completion"
  }
}
```

```json
{
  "id": "gsd",
  "name": "GSD",
  "supported_backends": ["claude"],
  "supported_phases": ["ideation", "planning", "execution", "verification"],
  "features": {
    "visual_companion": false,
    "interactive_questions": true
  },
  "phase_skills": {
    "ideation": "gsd:discuss-phase",
    "planning": "gsd:plan-phase",
    "execution": "gsd:execute-phase",
    "verification": "gsd:verify-work"
  }
}
```

```json
{
  "id": "native",
  "name": "Native",
  "supported_backends": ["claude", "codex"],
  "supported_phases": ["ideation", "planning", "execution", "verification", "review", "custom"],
  "features": {
    "visual_companion": false,
    "interactive_questions": false
  },
  "phase_skills": {}
}
```

### Key behaviors driven by manifests

- **UI filtering:** `supported_backends` determines which frameworks are selectable when a backend is chosen
- **Skill dispatch:** `phase_skills` maps phase type → skill name for the workflow engine to invoke
- **UI preparation:** `features` tells vibe-os whether to prepare companion server, interaction card rendering
- **Extensibility:** Adding Codex support for a framework requires: (1) add `"codex"` to `supported_backends` and map phase_skills in the manifest, (2) implement prompt translation / stdin interaction for that framework in the Codex adapter, (3) handle any framework-specific event patterns in the interaction router. The manifest drives the UI; the adapter code drives the behavior.

## Section 5: Context Handoff & Event Normalization

### Hybrid context handoff

Each phase produces two outputs when it completes:

1. **Artifact** — concrete output file stored in `.vibe-os/artifacts/{pipeline_run_id}/`:
   - Ideation → `spec.md` (design document)
   - Planning → `plan.md` (implementation plan)
   - Execution → `diff-summary.md` (see baseline strategy below)
   - Verification → `verification-report.md` (pass/fail, issues found)
   - Review → `review-notes.md` (feedback, requested changes)
   - Custom → `output.md` (whatever the phase produced)

2. **Summary** — compact context blurb (~200-500 tokens) stored in `phase_run.summary`. Generated by prompting the completing backend: "Summarize what was accomplished and any decisions made, in under 300 words."

The next phase receives as `framework_context`:
```
[Project Goal]: {user's original project description}
[Previous Phase]: {phase label} ({backend}/{framework}/{model})
[Summary]: {summary text}
[Artifact]:
{artifact content}
```

Token-conscious: the artifact is the full picture, the summary is the bridge for context-limited models.

### Phase baseline strategy for execution artifacts

A naive `git diff` after an execution phase would include unrelated dirty-worktree changes. The workflow engine must establish a clean baseline.

**Default: worktree isolation**

1. **Before execution phase starts:**
   - Record `HEAD` commit SHA as `phase_run.baseline_sha`
   - Create a temporary git worktree: `git worktree add .vibe-os/worktrees/{phase_run_id} -b vibe-phase/{phase_run_id}`
   - Store path in `phase_run.baseline_worktree_path`
   - Backend spawns with `working_dir` pointing to the worktree, not the main tree
2. **After execution phase completes:**
   - `git diff {baseline_sha}..HEAD` within the worktree captures only the phase's changes
   - Generate `diff-summary.md` from this scoped diff
3. **Merge back:** merge or cherry-pick the worktree branch into the main branch (user confirms via gate if gated, auto if auto)
4. **Cleanup:** `git worktree remove .vibe-os/worktrees/{phase_run_id}`

**Fallback: in-place with baseline SHA only**

For repos where worktrees aren't practical (submodules, sparse checkouts, large monorepos):
- Record `baseline_sha` only, run in the main tree
- Diff is `git diff {baseline_sha}` — may include unrelated changes if the tree was dirty
- Configurable per-phase: `isolation: "worktree" | "in-place"` (default `"worktree"`)

**Edge cases:**
- If execution phase fails mid-way, the worktree is preserved for manual recovery (not auto-cleaned). `baseline_worktree_path` in `phase_run` points to it.
- If the main branch advances while a worktree phase is running, merge-back may require conflict resolution — surfaced to the user via the gate prompt.

### Event normalization

Both adapters translate their CLI-specific output into the same `AgentEvent` enum:

| Concept | Claude CLI stream-json | Codex CLI output | Normalized AgentEvent |
|---|---|---|---|
| Thinking/text | `type: "assistant"`, content parts | stdout text blocks | `Think` |
| File edit | tool_use `Edit`/`Write` | file change events | `FileModify` / `FileCreate` |
| Command run | tool_use `Bash` | shell execution output | `TestRun` / `Raw` |
| Completion | `type: "result"` with cost/tokens | exit with summary | `Result` |
| Error | `is_error: true` | stderr / non-zero exit | `Error` |

### Frontend migration

The current frontend has two stream paths: `useClaudeStream` (disabled, listens to `"claude-stream"` for CLI stream-json) and `useAgentStream` (active, listens to `"agent-event"` for SDK sidecar traffic with `SdkAssistantMessage`/`SdkResultMessage` types). These are different event shapes.

**Unified approach:**
- Single `useAgentStream.ts` hook listens to `"agent-stream"` (unified channel)
- Events carry a `source` discriminator: `"cli-claude"` | `"cli-codex"` | `"sdk-sidecar"`
- Each source has its own normalization path within the hook, but all produce the same store mutations (`addSessionChatMessage`, `addSessionAgentEvent`, etc.)
- `useClaudeStream.ts` is deleted (already disabled)
- The existing `useAgentStream.ts` is refactored to handle all three sources
- `agentSlice.ts` — `ClaudeSessionState` → `AgentSessionState`, `claudeSessions` → `agentSessions`, adds `backend: "claude" | "codex" | "sidecar"` field
- All `claude`-prefixed store accessors renamed (see Prerequisite section)

## File Change Summary

### New Rust files (~12)
- `src-tauri/src/backends/mod.rs` — `BackendAdapter` trait, `SpawnArgs`, `ModelInfo`
- `src-tauri/src/backends/claude.rs` — `ClaudeAdapter` (wraps existing claude_commands logic)
- `src-tauri/src/backends/codex.rs` — `CodexAdapter`
- `src-tauri/src/services/codex_event_stream.rs` — Codex output parser
- `src-tauri/src/workflow/mod.rs` — `WorkflowEngine`
- `src-tauri/src/workflow/runner.rs` — phase execution, gate management
- `src-tauri/src/workflow/context.rs` — artifact store, summary generation, handoff
- `src-tauri/src/workflow/interaction.rs` — framework interaction routing
- `src-tauri/src/commands/workflow_commands.rs` — Tauri commands for pipeline CRUD + execution
- `src-tauri/frameworks/superpowers.json`
- `src-tauri/frameworks/gsd.json`
- `src-tauri/frameworks/native.json`

### Refactored Rust files (~3)
- `src-tauri/src/commands/claude_commands.rs` — extract core logic into `ClaudeAdapter`
- `src-tauri/src/services/event_stream.rs` — stays as-is, used by `ClaudeAdapter`
- `src-tauri/src/lib.rs` — register new commands, init workflow engine

### New frontend files (~8)
- `src/components/home/WorkflowBuilder.tsx`
- `src/components/home/PhasePalette.tsx`
- `src/components/home/PipelineCanvas.tsx`
- `src/components/home/PhaseCard.tsx`
- `src/components/home/ConnectionEditor.tsx`
- `src/components/home/PhaseConfigPanel.tsx`
- `src/components/conversation/InteractionCard.tsx`
- `src/components/conversation/PhaseIndicator.tsx`

### New SQLite migration
- Migration v9 (current DB is at v8): `projects`, `pipeline`, `pipeline_phase`, `pipeline_run`, `phase_run` tables
- Includes data migration: existing Zustand `Project` entries migrated into `projects` table

### Refactored frontend files (~6)
- `src/hooks/useAgentStream.ts` — refactored to handle three sources (cli-claude, cli-codex, sdk-sidecar)
- `src/hooks/useClaudeStream.ts` — deleted (already disabled)
- `src/stores/slices/agentSlice.ts` — `ClaudeSessionState` → `AgentSessionState`, `claudeSessions` → `agentSessions`, all `claude`-prefixed accessors renamed
- `src/stores/slices/projectSlice.ts` — projects backed by SQLite instead of Zustand-only, `claudeSessionId` → `activeSessionId`
- `src/stores/types.ts` — new types for pipeline, phase, workflow state; renamed session types
- `src/lib/tauri.ts` — add workflow + project command wrappers

**Total: ~22 new files, ~10 refactored files**
