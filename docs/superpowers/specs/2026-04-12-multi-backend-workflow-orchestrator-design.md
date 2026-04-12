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

Framework compatibility is data-driven (JSON manifests), not hardcoded. Adding new framework+backend combos is a config change.

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

### SQLite tables (new migration)

```sql
-- Each project has one pipeline
CREATE TABLE pipeline (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT DEFAULT 'Default',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Ordered phases within a pipeline
CREATE TABLE pipeline_phase (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  phase_type TEXT NOT NULL,          -- ideation|planning|execution|verification|review|custom
  backend TEXT NOT NULL,             -- "claude" | "codex"
  framework TEXT NOT NULL,           -- "superpowers" | "gsd" | "native" | "custom"
  model TEXT NOT NULL,               -- "opus" | "sonnet" | "haiku" | "gpt-4.1" | "o3" | etc.
  custom_prompt TEXT,                -- user-provided system prompt when framework = "custom"
  gate_after TEXT DEFAULT 'gated'    -- "gated" | "auto"
);

-- Phase execution state
CREATE TABLE phase_run (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  phase_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,              -- pending|running|awaiting_input|completed|failed
  artifact_path TEXT,
  summary TEXT,
  started_at TEXT,
  completed_at TEXT
);
```

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
- **Extensibility:** Adding Codex support for a framework = add `"codex"` to `supported_backends` and map skills

## Section 5: Context Handoff & Event Normalization

### Hybrid context handoff

Each phase produces two outputs when it completes:

1. **Artifact** — concrete output file stored in `.vibe-os/artifacts/{pipeline_run_id}/`:
   - Ideation → `spec.md` (design document)
   - Planning → `plan.md` (implementation plan)
   - Execution → `diff-summary.md` (auto-generated from git diff of changes)
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

- `useClaudeStream.ts` → renamed to `useAgentStream.ts`
- Listens to `"agent-stream"` instead of `"claude-stream"`
- Event handling logic is identical — both backends emit normalized `AgentEvent`s
- `agentSlice.ts` — `ClaudeSessionState` renamed to `AgentSessionState`, adds `backend: "claude" | "codex"` field

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

### Refactored frontend files (~4)
- `src/hooks/useClaudeStream.ts` → `src/hooks/useAgentStream.ts`
- `src/stores/slices/agentSlice.ts` — `ClaudeSessionState` → `AgentSessionState`, add `backend` field
- `src/stores/types.ts` — new types for pipeline, phase, workflow state
- `src/lib/tauri.ts` — add workflow command wrappers

### New SQLite migration
- Migration v7: `pipeline`, `pipeline_phase`, `phase_run` tables

**Total: ~20 new files, ~7 refactored files**
