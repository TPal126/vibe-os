# Workflow Orchestrator — Plan 2: Backend Adapters + Workflow Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the ClaudeAdapter and CodexAdapter behind the BackendAdapter trait, build the Codex CLI event parser, create a workflow engine that runs pipelines phase-by-phase with context handoff and configurable gates, and wire unified Tauri commands that dispatch through the adapter layer.

**Architecture:** Two adapters implement the BackendAdapter trait, emitting normalized AgentEvents on `"agent-stream"`. A WorkflowEngine loads pipeline definitions from SQLite, runs phases sequentially, manages artifacts/summaries for context handoff, and handles gated transitions. The frontend's useAgentStream hook gains CLI source handling.

**Tech Stack:** Rust (tokio, tauri, rusqlite, serde), TypeScript (Zustand, Tauri IPC)

**Spec:** `docs/superpowers/specs/2026-04-12-multi-backend-workflow-orchestrator-design.md`

**Sequencing:** This is Plan 2 of 3. Depends on Plan 1 (foundation). Plan 3 (frontend UI) depends on this.

**Codex CLI JSONL format** (captured from `codex exec --json`):
```jsonl
{"type":"thread.started","thread_id":"..."}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"..."}}
{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"...","status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"...","aggregated_output":"...","exit_code":0,"status":"completed"}}
{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"..."}}
{"type":"turn.completed","usage":{"input_tokens":N,"cached_input_tokens":N,"output_tokens":N}}
{"type":"error","message":"..."}
{"type":"turn.failed","error":{"message":"..."}}
```

---

## File Map

### Rust — Modified
- `src-tauri/src/backends/mod.rs` — Expand BackendAdapter trait with full spawn/cancel/validate methods, add SpawnArgs, AgentProcesses type
- `src-tauri/src/services/event_stream.rs` — Add new AgentEventType variants (InteractionRequest, VisualContent, ArtifactProduced, PhaseTransition)
- `src-tauri/src/commands/claude_commands.rs` — Change all `"claude-stream"` emits to `"agent-stream"` with envelope format
- `src-tauri/src/lib.rs` — Register new commands, register `AgentProcesses` managed state
- `src-tauri/src/commands/mod.rs` — Export new workflow_commands module

### Rust — Created
- `src-tauri/src/backends/claude.rs` — ClaudeAdapter implementing BackendAdapter
- `src-tauri/src/backends/codex.rs` — CodexAdapter implementing BackendAdapter
- `src-tauri/src/services/codex_event_stream.rs` — Codex JSONL parser → AgentEvent
- `src-tauri/src/workflow/runner.rs` — Pipeline runner: phase sequencing, gate management
- `src-tauri/src/workflow/context.rs` — Artifact store, summary generation, context handoff
- `src-tauri/src/commands/workflow_commands.rs` — Tauri commands: start_pipeline, advance_gate, get_run_status

### TypeScript — Modified
- `src/hooks/useAgentStream.ts` — Add CLI source handling for `"cli-claude"` and `"cli-codex"`
- `src/stores/types.ts` — Add new AgentEventType values, pipeline run state types
- `src/lib/tauri.ts` — Add workflow command wrappers

---

## Milestone A: Fix Emit Channel + Expand Core Types + Register Managed State

**Plan 1 baseline:** `agent_session_id` in Rust, `AgentSessionState`/`agentSessions`/`activeSessionId` in frontend, `useAgentStream` listening on `"agent-stream"` with `source` field — all done. However, `claude_commands.rs` still emits on `"claude-stream"`, which breaks the CLI path. Fix that first.

### Task 1: Fix claude_commands.rs emit channel + register AgentProcesses

**Files:**
- Modify: `src-tauri/src/commands/claude_commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Replace all "claude-stream" with "agent-stream"**

In `src-tauri/src/commands/claude_commands.rs`, find and replace all 9 occurrences of `"claude-stream"` with `"agent-stream"`.

- [ ] **Step 2: Register AgentProcesses managed state in lib.rs**

In `src-tauri/src/lib.rs`, inside the `.setup(|app| { ... })` block, add after the existing `app.manage(...)` calls:

```rust
// Register backend process registry (used by adapters + workflow engine)
app.manage(crate::backends::AgentProcesses::default());
```

This ensures `app.state::<AgentProcesses>()` works at runtime when adapters need it.

- [ ] **Step 3: Build to verify**

Run: `cargo build -p vibe-os`
Expected: Compiles.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/claude_commands.rs src-tauri/src/lib.rs
git commit -m "fix: change emit channel to agent-stream, register AgentProcesses state"
```

### Task 2: Add new AgentEventType variants

**Files:**
- Modify: `src-tauri/src/services/event_stream.rs:6-18`
- Modify: `src/stores/types.ts:241-255`

- [ ] **Step 1: Add Rust enum variants**

In `src-tauri/src/services/event_stream.rs`, add 4 new variants to `AgentEventType`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgentEventType {
    Think,
    Decision,
    FileCreate,
    FileModify,
    TestRun,
    PreviewUpdate,
    Error,
    Result,
    Raw,
    // Workflow engine events (Plan 2)
    InteractionRequest,
    VisualContent,
    ArtifactProduced,
    PhaseTransition,
}
```

- [ ] **Step 2: Add TypeScript type values**

In `src/stores/types.ts`, update the `AgentEventType` union:

```typescript
export type AgentEventType =
  | "think"
  | "decision"
  | "file_create"
  | "file_modify"
  | "test_run"
  | "preview_update"
  | "error"
  | "result"
  | "raw"
  | "agent_spawn"
  | "agent_complete"
  | "task_create"
  | "task_update"
  | "api_metrics"
  | "interaction_request"
  | "visual_content"
  | "artifact_produced"
  | "phase_transition";
```

- [ ] **Step 3: Run tests**

Run: `cargo test --lib -p vibe-os -- event_stream && npx tsc --noEmit`
Expected: All pass — new variants are additive.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/services/event_stream.rs src/stores/types.ts
git commit -m "feat: add workflow AgentEventType variants (InteractionRequest, PhaseTransition, etc.)"
```

---

## Milestone B: Codex Event Parser

### Task 3: Create codex_event_stream.rs

**Files:**
- Create: `src-tauri/src/services/codex_event_stream.rs`
- Modify: `src-tauri/src/services/mod.rs` (if exists) or add `pub mod` in the appropriate place

This parser translates Codex CLI `--json` JSONL output into the same `AgentEvent` type that the Claude parser produces.

- [ ] **Step 1: Create the parser module**

Create `src-tauri/src/services/codex_event_stream.rs`:

```rust
use chrono::Utc;
use serde::Deserialize;

use super::event_stream::{AgentEvent, AgentEventType};

// ── Codex JSONL Event Structures ──
// These mirror Codex CLI's `codex exec --json` output

#[derive(Debug, Deserialize)]
struct CodexEvent {
    #[serde(rename = "type")]
    event_type: String,
    // thread.started
    thread_id: Option<String>,
    // item.started / item.completed
    item: Option<CodexItem>,
    // turn.completed
    usage: Option<CodexUsage>,
    // error
    message: Option<String>,
    // turn.failed
    error: Option<CodexError>,
}

#[derive(Debug, Deserialize)]
struct CodexItem {
    id: Option<String>,
    #[serde(rename = "type")]
    item_type: Option<String>,
    // agent_message
    text: Option<String>,
    // command_execution
    command: Option<String>,
    aggregated_output: Option<String>,
    exit_code: Option<i32>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CodexUsage {
    input_tokens: Option<u64>,
    cached_input_tokens: Option<u64>,
    output_tokens: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct CodexError {
    message: Option<String>,
}

// ── Parser ──

/// Parse a single line of Codex CLI JSONL output into an AgentEvent.
/// Returns an AgentEvent for every line — unparseable lines become Raw events.
pub fn parse_event(line: &str) -> AgentEvent {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return make_event(AgentEventType::Raw, String::new(), None);
    }

    match serde_json::from_str::<CodexEvent>(trimmed) {
        Ok(evt) => classify_event(evt),
        Err(_) => make_event(AgentEventType::Raw, trimmed.to_string(), None),
    }
}

fn classify_event(evt: CodexEvent) -> AgentEvent {
    match evt.event_type.as_str() {
        "thread.started" => {
            let thread_id = evt.thread_id.unwrap_or_default();
            make_event(
                AgentEventType::Raw,
                String::new(),
                Some(serde_json::json!({ "thread_id": thread_id })),
            )
        }
        "turn.started" => make_event(AgentEventType::Raw, String::new(), None),
        "turn.completed" => {
            let metadata = if let Some(usage) = evt.usage {
                Some(serde_json::json!({
                    "input_tokens": usage.input_tokens,
                    "cached_input_tokens": usage.cached_input_tokens,
                    "output_tokens": usage.output_tokens,
                }))
            } else {
                None
            };
            // turn.completed with usage acts as a result-like event
            make_event(AgentEventType::Result, String::new(), metadata)
        }
        "item.started" | "item.completed" => {
            if let Some(item) = evt.item {
                classify_item(&evt.event_type, item)
            } else {
                make_event(AgentEventType::Raw, String::new(), None)
            }
        }
        "error" => {
            let msg = evt.message.unwrap_or_else(|| "Unknown error".to_string());
            make_event(AgentEventType::Error, msg, None)
        }
        "turn.failed" => {
            let msg = evt
                .error
                .and_then(|e| e.message)
                .unwrap_or_else(|| "Turn failed".to_string());
            make_event(AgentEventType::Error, msg, None)
        }
        _ => make_event(
            AgentEventType::Raw,
            format!("unknown codex event: {}", evt.event_type),
            None,
        ),
    }
}

fn classify_item(event_type: &str, item: CodexItem) -> AgentEvent {
    let item_type = item.item_type.as_deref().unwrap_or("");

    match item_type {
        "agent_message" => {
            let text = item.text.unwrap_or_default();
            if text.is_empty() {
                make_event(AgentEventType::Raw, String::new(), None)
            } else {
                make_event(AgentEventType::Think, text, None)
            }
        }
        "command_execution" => {
            let cmd = item.command.as_deref().unwrap_or("");
            let status = item.status.as_deref().unwrap_or("");
            let exit_code = item.exit_code;

            if event_type == "item.started" {
                // Command starting — emit as Think with tool metadata
                make_event(
                    AgentEventType::Think,
                    format!("Executing: {}", truncate(cmd, 80)),
                    Some(serde_json::json!({
                        "tool": "Bash",
                        "command": cmd,
                        "status": status,
                    })),
                )
            } else {
                // Command completed — classify based on command content
                let is_test = cmd.contains("test")
                    || cmd.contains("pytest")
                    || cmd.contains("cargo test")
                    || cmd.contains("npm test");

                let output = item.aggregated_output.as_deref().unwrap_or("");

                if is_test {
                    make_event(
                        AgentEventType::TestRun,
                        format!("Ran: {}", truncate(cmd, 80)),
                        Some(serde_json::json!({
                            "tool": "Bash",
                            "command": cmd,
                            "output": truncate(output, 500),
                            "exit_code": exit_code,
                        })),
                    )
                } else {
                    make_event(
                        AgentEventType::Think,
                        format!("Executed: {}", truncate(cmd, 80)),
                        Some(serde_json::json!({
                            "tool": "Bash",
                            "command": cmd,
                            "output": truncate(output, 500),
                            "exit_code": exit_code,
                        })),
                    )
                }
            }
        }
        // NOTE: Codex CLI (as of captured fixtures) only emits "agent_message" and
        // "command_execution" item types. If future versions emit file-specific item
        // types, add handlers here backed by captured fixture data.
        _ => {
            let text = item.text.unwrap_or_default();
            make_event(AgentEventType::Raw, text, None)
        }
    }
}

fn make_event(
    event_type: AgentEventType,
    content: String,
    metadata: Option<serde_json::Value>,
) -> AgentEvent {
    AgentEvent {
        timestamp: Utc::now().to_rfc3339(),
        event_type,
        content,
        metadata,
        agent_session_id: None,
    }
}

fn truncate(s: &str, max: usize) -> &str {
    if s.len() <= max {
        s
    } else {
        &s[..max]
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    // Real Codex CLI fixtures (captured from `codex exec --json`)

    const THREAD_STARTED: &str = r#"{"type":"thread.started","thread_id":"019d82d4-a270-7c93-aa19-bfc29826ba30"}"#;
    const TURN_STARTED: &str = r#"{"type":"turn.started"}"#;
    const AGENT_MESSAGE: &str = r#"{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"4"}}"#;
    const TURN_COMPLETED: &str = r#"{"type":"turn.completed","usage":{"input_tokens":10884,"cached_input_tokens":9600,"output_tokens":5}}"#;
    const CMD_STARTED: &str = r#"{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"cat package.json","aggregated_output":"","exit_code":null,"status":"in_progress"}}"#;
    const CMD_COMPLETED: &str = r#"{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"cat package.json","aggregated_output":"{\"name\":\"vibe-os\"}","exit_code":0,"status":"completed"}}"#;
    const CMD_TEST: &str = r#"{"type":"item.completed","item":{"id":"item_2","type":"command_execution","command":"npm test","aggregated_output":"5 passed","exit_code":0,"status":"completed"}}"#;
    const ERROR_EVENT: &str = r#"{"type":"error","message":"Something went wrong"}"#;
    const TURN_FAILED: &str = r#"{"type":"turn.failed","error":{"message":"Model not supported"}}"#;

    #[test]
    fn parse_thread_started() {
        let event = parse_event(THREAD_STARTED);
        assert_eq!(event.event_type, AgentEventType::Raw);
        let meta = event.metadata.unwrap();
        assert_eq!(meta["thread_id"], "019d82d4-a270-7c93-aa19-bfc29826ba30");
    }

    #[test]
    fn parse_turn_started_is_raw() {
        let event = parse_event(TURN_STARTED);
        assert_eq!(event.event_type, AgentEventType::Raw);
    }

    #[test]
    fn parse_agent_message() {
        let event = parse_event(AGENT_MESSAGE);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert_eq!(event.content, "4");
        assert!(event.metadata.is_none());
    }

    #[test]
    fn parse_turn_completed_as_result() {
        let event = parse_event(TURN_COMPLETED);
        assert_eq!(event.event_type, AgentEventType::Result);
        let meta = event.metadata.unwrap();
        assert_eq!(meta["input_tokens"], 10884);
        assert_eq!(meta["output_tokens"], 5);
    }

    #[test]
    fn parse_command_started() {
        let event = parse_event(CMD_STARTED);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert!(event.content.contains("cat package.json"));
        let meta = event.metadata.unwrap();
        assert_eq!(meta["tool"], "Bash");
    }

    #[test]
    fn parse_command_completed() {
        let event = parse_event(CMD_COMPLETED);
        assert_eq!(event.event_type, AgentEventType::Think);
        assert!(event.content.contains("cat package.json"));
        let meta = event.metadata.unwrap();
        assert_eq!(meta["exit_code"], 0);
    }

    #[test]
    fn parse_test_command() {
        let event = parse_event(CMD_TEST);
        assert_eq!(event.event_type, AgentEventType::TestRun);
        assert!(event.content.contains("npm test"));
    }

    #[test]
    fn parse_error() {
        let event = parse_event(ERROR_EVENT);
        assert_eq!(event.event_type, AgentEventType::Error);
        assert_eq!(event.content, "Something went wrong");
    }

    #[test]
    fn parse_turn_failed() {
        let event = parse_event(TURN_FAILED);
        assert_eq!(event.event_type, AgentEventType::Error);
        assert_eq!(event.content, "Model not supported");
    }

    #[test]
    fn parse_empty_line() {
        let event = parse_event("");
        assert_eq!(event.event_type, AgentEventType::Raw);
    }

    #[test]
    fn parse_invalid_json() {
        let event = parse_event("not json");
        assert_eq!(event.event_type, AgentEventType::Raw);
    }

    #[test]
    fn agent_message_has_no_tool_metadata() {
        let event = parse_event(AGENT_MESSAGE);
        match &event.metadata {
            None => {} // correct
            Some(meta) => {
                assert!(meta.get("tool").is_none(), "agent_message must not have tool metadata");
            }
        }
    }
}
```

- [ ] **Step 2: Register the module**

If `src-tauri/src/services/mod.rs` exists, add `pub mod codex_event_stream;`. If not, check how `event_stream` is currently exported (it may be declared directly in `lib.rs` or via `mod services` with a mod.rs).

- [ ] **Step 3: Run tests**

Run: `cargo test --lib -p vibe-os -- codex_event_stream`
Expected: All 12 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/services/codex_event_stream.rs src-tauri/src/services/mod.rs
git commit -m "feat: add Codex CLI JSONL event parser with tests"
```

---

## Milestone C: Backend Adapters

### Task 4: Expand BackendAdapter trait and add SpawnArgs

**Files:**
- Modify: `src-tauri/src/backends/mod.rs`

- [ ] **Step 1: Expand the trait and add supporting types**

Replace the current minimal `BackendAdapter` trait in `src-tauri/src/backends/mod.rs` with the full version. Keep all existing types (FrameworkManifest, etc.) and `list_frameworks` command. Add before them:

```rust
use std::process::Child;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;
use tauri::AppHandle;

/// Backend-agnostic arguments for spawning a CLI process.
#[derive(Debug, Clone)]
pub struct SpawnArgs {
    pub working_dir: String,
    pub message: String,
    pub system_prompt: Option<String>,
    pub session_id: String,
    pub model: Option<String>,
    pub framework_context: Option<String>,
    pub resume_id: Option<String>,
}

/// Managed state for active CLI processes across all backends.
/// Key: agent_session_id, Value: the Child handle.
pub type AgentProcesses = Arc<TokioMutex<std::collections::HashMap<String, Child>>>;

/// Info about an installed CLI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliInfo {
    pub name: String,
    pub version: String,
}

pub trait BackendAdapter: Send + Sync {
    fn name(&self) -> &str;
    fn validate(&self) -> Result<CliInfo, String>;
    fn spawn(&self, args: SpawnArgs, app: &AppHandle) -> Result<String, String>;
    fn send_input(&self, session_id: &str, input: &str, app: &AppHandle) -> Result<(), String>;
    fn cancel(&self, session_id: &str, app: &AppHandle) -> Result<(), String>;
    fn supported_models(&self) -> Vec<ModelInfo>;
}
```

- [ ] **Step 2: Build to verify**

Run: `cargo build -p vibe-os`
Expected: Compiles (trait is defined but not yet implemented).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/backends/mod.rs
git commit -m "feat: expand BackendAdapter trait with full spawn/cancel/validate interface"
```

### Task 5: Implement ClaudeAdapter

**Files:**
- Create: `src-tauri/src/backends/claude.rs`
- Modify: `src-tauri/src/backends/mod.rs` — add `pub mod claude;`

The ClaudeAdapter wraps the existing spawn/parse/emit logic from `claude_commands.rs`. It implements `BackendAdapter` by delegating to the same process spawning pattern.

- [ ] **Step 1: Create claude.rs**

Create `src-tauri/src/backends/claude.rs` that implements `BackendAdapter` for a `ClaudeAdapter` struct. The `spawn` method should replicate the core logic from `claude_commands::start_claude` — build CLI args, spawn `claude -p --output-format stream-json --verbose`, read stdout via `event_stream::parse_event`, handle stderr. Use `AgentProcesses` (from mod.rs) for process management instead of `ClaudeProcesses`.

**IMPORTANT: Event envelope format.** All emits to `"agent-stream"` must use the unified envelope, not raw AgentEvents:
```rust
// For agent events:
app.emit("agent-stream", serde_json::json!({
    "type": "agent_event",
    "source": "cli-claude",
    "sessionId": &session_id,
    "event": &agent_event,
}));
// For status events:
app.emit("agent-stream", serde_json::json!({
    "type": "status",
    "source": "cli-claude",
    "sessionId": &session_id,
    "status": "working", // or "done" or "cancelled"
}));
```

The `validate` method runs `claude --version`. The `cancel` method kills the process by session_id. `supported_models` returns Claude model options.

Read `src-tauri/src/commands/claude_commands.rs` carefully — the adapter should extract the process spawn + stdout reader + stderr reader pattern into the trait implementation.

- [ ] **Step 2: Register module**

Add `pub mod claude;` to `src-tauri/src/backends/mod.rs`.

- [ ] **Step 3: Build to verify**

Run: `cargo build -p vibe-os`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/backends/claude.rs src-tauri/src/backends/mod.rs
git commit -m "feat: implement ClaudeAdapter wrapping existing CLI spawn logic"
```

### Task 6: Implement CodexAdapter

**Files:**
- Create: `src-tauri/src/backends/codex.rs`
- Modify: `src-tauri/src/backends/mod.rs` — add `pub mod codex;`

Same pattern as ClaudeAdapter but for Codex CLI. Spawns `codex exec --json -m {model} {message}`, parses stdout via `codex_event_stream::parse_event`.

- [ ] **Step 1: Create codex.rs**

Create `src-tauri/src/backends/codex.rs`. The `CodexAdapter` struct implements `BackendAdapter`:

- `validate` runs `codex --version`
- `spawn` builds args for `codex exec --json`, optionally with `-m {model}`, pipes the message via the prompt argument, spawns the process, reads stdout line by line through `codex_event_stream::parse_event`, handles stderr
- `cancel` kills process by session_id
- `supported_models` returns Codex model options (o3, gpt-4.1, o4-mini, etc.)

**IMPORTANT: Event envelope format.** Same as ClaudeAdapter — all emits use the unified envelope with `"source": "cli-codex"`. See Task 5 for the exact format.

The system_prompt from SpawnArgs should be prepended to the message for Codex (Codex doesn't have a separate `--system-prompt` flag — it's part of the prompt text).

The `framework_context` from SpawnArgs should also be prepended to the message.

- [ ] **Step 2: Register module**

Add `pub mod codex;` to `src-tauri/src/backends/mod.rs`.

- [ ] **Step 3: Build to verify**

Run: `cargo build -p vibe-os`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/backends/codex.rs src-tauri/src/backends/mod.rs
git commit -m "feat: implement CodexAdapter for Codex CLI integration"
```

---

## Milestone D: Workflow Engine

### Task 7: Workflow runner — phase sequencing and gate management

**Files:**
- Create: `src-tauri/src/workflow/runner.rs`
- Modify: `src-tauri/src/workflow/mod.rs`

**IMPORTANT: All methods must have real implementations, not `todo!()` stubs.** Each method queries the SQLite tables from Plan 1 (pipeline, pipeline_phase, pipeline_run, phase_run) and performs real orchestration. The runner accesses `DbState` and `AgentProcesses` via `self.app.state::<T>()`.

- [ ] **Step 1: Create runner.rs with full implementations**

Create `src-tauri/src/workflow/runner.rs` with a `WorkflowRunner` struct. Every method must be fully implemented:

**`start_pipeline(pipeline_id)`:**
1. Query `pipeline_phase` for all phases ordered by `position` where `pipeline_id` matches
2. If no phases, return error
3. Insert a `pipeline_run` row with `status = "running"`, return its id
4. Call `self.start_phase()` with the first phase and no previous context

**`start_phase(pipeline_run_id, phase_id, previous_context)`:**
1. Query `pipeline_phase` for this phase's config (backend, framework, model, custom_prompt)
2. Load framework manifest via `crate::backends::load_manifests()` to get the phase skill
3. Build `SpawnArgs` with: working_dir from the project's workspace_path, message composed from framework skill + previous_context, model from phase config
4. Insert a `phase_run` row with `status = "running"`
5. Look up the right adapter by backend name ("claude" → ClaudeAdapter, "codex" → CodexAdapter)
6. Call `adapter.spawn(args, &self.app)`
7. Return the `phase_run_id`

**`on_phase_complete(pipeline_run_id, phase_run_id)`:**
1. Update `phase_run` status to `"completed"`, set `completed_at`
2. Query the phase's `gate_after` setting
3. Query whether there's a next phase (by position)
4. If `gate_after = "auto"` and next phase exists → call `start_phase` for next phase
5. If `gate_after = "gated"` → update status to `"awaiting_gate"`, emit a `PhaseTransition` AgentEvent on `"agent-stream"`
6. If no next phase → update `pipeline_run` status to `"completed"`

**`advance_gate(pipeline_run_id)`:**
1. Find the `phase_run` with `status = "awaiting_gate"` for this pipeline_run
2. Update its status to `"completed"`
3. Find the next phase by position
4. Call `start_phase` with context from the completed phase's summary/artifact

**`get_run_status(pipeline_run_id)`:**
1. Query `pipeline_run` for status
2. Query all `phase_run` rows for this run, join with `pipeline_phase` for labels
3. Return `PipelineRunStatus` with current and completed phases

```rust
#[derive(Debug, Clone, serde::Serialize)]
pub struct PipelineRunStatus {
    pub pipeline_run_id: String,
    pub status: String,
    pub current_phase: Option<PhaseRunInfo>,
    pub completed_phases: Vec<PhaseRunInfo>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PhaseRunInfo {
    pub phase_run_id: String,
    pub phase_id: String,
    pub label: String,
    pub status: String,
    pub artifact_path: Option<String>,
    pub summary: Option<String>,
}
```

- [ ] **Step 2: Update workflow/mod.rs**

Replace the stub comment in `src-tauri/src/workflow/mod.rs`:

```rust
pub mod runner;
pub mod context;
```

- [ ] **Step 3: Build to verify**

Run: `cargo build -p vibe-os`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/workflow/runner.rs src-tauri/src/workflow/mod.rs
git commit -m "feat: add WorkflowRunner with phase sequencing and gate management"
```

### Task 8: Context handoff — artifact store and summary generation

**Files:**
- Create: `src-tauri/src/workflow/context.rs`

- [ ] **Step 1: Create context.rs**

Create `src-tauri/src/workflow/context.rs`:

```rust
use std::path::{Path, PathBuf};
use std::fs;

/// Manages artifact storage and context handoff between pipeline phases.
pub struct ArtifactStore {
    base_dir: PathBuf, // ~/.vibe-os/artifacts/
}

impl ArtifactStore {
    pub fn new(app_data_dir: &Path) -> Self {
        let base_dir = app_data_dir.join("artifacts");
        Self { base_dir }
    }

    /// Get the artifact directory for a pipeline run.
    pub fn run_dir(&self, pipeline_run_id: &str) -> PathBuf {
        self.base_dir.join(pipeline_run_id)
    }

    /// Store an artifact file for a phase.
    pub fn store_artifact(
        &self,
        pipeline_run_id: &str,
        phase_type: &str,
        content: &str,
    ) -> Result<PathBuf, String> {
        let dir = self.run_dir(pipeline_run_id);
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create artifact dir: {}", e))?;

        let filename = match phase_type {
            "ideation" => "spec.md",
            "planning" => "plan.md",
            "execution" => "diff-summary.md",
            "verification" => "verification-report.md",
            "review" => "review-notes.md",
            _ => "output.md",
        };

        let path = dir.join(filename);
        fs::write(&path, content)
            .map_err(|e| format!("Failed to write artifact: {}", e))?;

        Ok(path)
    }

    /// Load an artifact's content.
    pub fn load_artifact(&self, path: &Path) -> Result<String, String> {
        fs::read_to_string(path)
            .map_err(|e| format!("Failed to read artifact: {}", e))
    }

    /// Build the framework_context string for the next phase.
    pub fn build_handoff_context(
        &self,
        project_goal: &str,
        previous_phase_label: &str,
        previous_phase_config: &str, // e.g., "claude/superpowers/opus"
        summary: &str,
        artifact_path: Option<&Path>,
    ) -> String {
        let mut context = format!(
            "[Project Goal]: {}\n[Previous Phase]: {} ({})\n[Summary]: {}\n",
            project_goal, previous_phase_label, previous_phase_config, summary,
        );

        if let Some(path) = artifact_path {
            if let Ok(content) = self.load_artifact(path) {
                context.push_str(&format!("[Artifact]:\n{}\n", content));
            }
        }

        context
    }
}
```

- [ ] **Step 2: Build to verify**

Run: `cargo build -p vibe-os`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/workflow/context.rs
git commit -m "feat: add ArtifactStore for phase context handoff"
```

### Task 9: Workflow Tauri commands

**Files:**
- Create: `src-tauri/src/commands/workflow_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create workflow_commands.rs**

Create `src-tauri/src/commands/workflow_commands.rs` with 3 commands:

```rust
use tauri::AppHandle;
use crate::workflow::runner::WorkflowRunner;

/// Start executing a pipeline. Returns the pipeline_run_id.
#[tauri::command]
pub async fn start_pipeline(app: AppHandle, pipeline_id: String) -> Result<String, String> {
    let runner = WorkflowRunner::new(app);
    runner.start_pipeline(&pipeline_id).await
}

/// User confirms a gate — advance to the next phase.
#[tauri::command]
pub async fn advance_gate(app: AppHandle, pipeline_run_id: String) -> Result<(), String> {
    let runner = WorkflowRunner::new(app);
    runner.advance_gate(&pipeline_run_id).await
}

/// Get the current status of a pipeline run.
#[tauri::command]
pub async fn get_pipeline_run_status(
    app: AppHandle,
    pipeline_run_id: String,
) -> Result<crate::workflow::runner::PipelineRunStatus, String> {
    let runner = WorkflowRunner::new(app);
    runner.get_run_status(&pipeline_run_id).await
}
```

- [ ] **Step 2: Register**

Add `pub mod workflow_commands;` to mod.rs. Add imports and handlers to lib.rs:

```rust
use commands::workflow_commands;
// In generate_handler![]:
workflow_commands::start_pipeline,
workflow_commands::advance_gate,
workflow_commands::get_pipeline_run_status,
```

- [ ] **Step 3: Build to verify**

Run: `cargo build -p vibe-os`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/workflow_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add workflow Tauri commands (start_pipeline, advance_gate, get_status)"
```

---

## Milestone E: Frontend Integration

### Task 10: Define unified event envelope and add CLI source handling

**Files:**
- Modify: `src/hooks/useAgentStream.ts`
- Modify: `src/lib/tauri.ts`

**Design decision:** All sources must use a single `AgentStreamPayload` envelope. The current sidecar uses `{ type: "sdk_message" | ..., sessionId, message }`. CLI adapters will use `{ type: "agent_event", source, sessionId, event }`. Both shapes share the same top-level `type` discriminator — no casting or `as unknown`.

- [ ] **Step 1: Define the unified envelope type**

In `src/hooks/useAgentStream.ts`, replace the existing `AgentEventPayload` interface:

```typescript
/** Envelope for CLI adapter events */
interface CliEventPayload {
  type: "agent_event";
  source: "cli-claude" | "cli-codex";
  sessionId: string;
  event: {
    event_type: string;
    content: string;
    metadata?: Record<string, unknown>;
    timestamp: string;
  };
}

/** Envelope for CLI status events (working/done/cancelled) */
interface CliStatusPayload {
  type: "status";
  source: "cli-claude" | "cli-codex";
  sessionId: string;
  status: "working" | "done" | "cancelled";
  invocation_id?: string;
  exit_code?: number | null;
}

/** Existing sidecar envelope (unchanged) */
interface SidecarPayload {
  type: "sdk_message" | "sidecar_ready" | "session_ended" | "error";
  source?: "sdk-sidecar";
  sessionId?: string;
  message?: SdkAssistantMessage | SdkResultMessage | Record<string, unknown>;
  error?: string;
}

type AgentStreamPayload = CliEventPayload | CliStatusPayload | SidecarPayload;
```

**IMPORTANT:** The Rust adapters must also emit this envelope shape. In each adapter's emit calls, wrap the AgentEvent in the envelope:

```rust
// In adapter emit code (Rust side):
app.emit("agent-stream", serde_json::json!({
    "type": "agent_event",
    "source": "cli-claude",  // or "cli-codex"
    "sessionId": &session_id,
    "event": &agent_event,
}));
```

And for status events:
```rust
app.emit("agent-stream", serde_json::json!({
    "type": "status",
    "source": "cli-claude",
    "sessionId": &session_id,
    "status": "working",
}));
```

- [ ] **Step 2: Add CLI event dispatch in the listener**

After the existing sidecar handling block, add:

```typescript
if (data.type === "status" && "source" in data) {
  const statusData = data as CliStatusPayload;
  const sid = statusData.sessionId;
  if (!store.agentSessions.has(sid)) {
    const backend = statusData.source === "cli-claude" ? "claude" : "codex";
    store.createSessionLocal(sid, "CLI Session", backend as any);
  }
  if (statusData.status === "working") {
    store.setSessionWorking(sid, true);
  } else {
    store.setSessionWorking(sid, false);
  }
  return;
}

if (data.type === "agent_event") {
  const cliData = data as CliEventPayload;
  const sid = cliData.sessionId;
  const evt = cliData.event;
  const backend = cliData.source === "cli-claude" ? "claude" : "codex";

  if (!store.agentSessions.has(sid)) {
    store.createSessionLocal(sid, "CLI Session", backend as any);
  }

  const eventType = evt.event_type;
  const content = evt.content || "";
  const meta = evt.metadata;

  // Agent text (think events without tool metadata)
  if (eventType === "think" && !meta?.tool) {
    store.appendToSessionLastAssistant(sid, content);
    return;
  }

  // Tool use / activity events
  if (meta?.tool) {
    const agentEvent = { timestamp: evt.timestamp, event_type: eventType as any, content, metadata: meta };
    store.addSessionAgentEvent(sid, agentEvent);
    store.upsertActivityLine(sid, agentEvent);
    return;
  }

  // Result events
  if (eventType === "result") {
    store.setSessionWorking(sid, false);
    store.finalizeActivityLine(sid);
    store.insertRichCard(sid, "outcome", content, {
      cost_usd: meta?.cost_usd,
      input_tokens: meta?.input_tokens,
      output_tokens: meta?.output_tokens,
      duration_ms: meta?.duration_ms,
    });
    if (meta?.input_tokens || meta?.output_tokens) {
      store.setSessionApiMetrics(sid, {
        inputTokens: (meta.input_tokens as number) || 0,
        outputTokens: (meta.output_tokens as number) || 0,
        cacheCreationInputTokens: (meta.cache_creation_input_tokens as number) || 0,
        cacheReadInputTokens: (meta.cache_read_input_tokens as number) || 0,
        cost: (meta.cost_usd as number) || 0,
        durationMs: (meta.duration_ms as number) || 0,
        durationApiMs: (meta.duration_api_ms as number) || 0,
      });
    }
    return;
  }

  // Error events
  if (eventType === "error") {
    store.setSessionError(sid, content);
    store.insertRichCard(sid, "error", content, {});
    return;
  }

  // Phase transition events
  if (eventType === "phase_transition") {
    store.insertRichCard(sid, "outcome", content, { ...meta, cardSubtype: "phase_transition" });
    return;
  }
}
```

**NOTE:** The adapters (Tasks 5 and 6) must emit using the envelope format above, not raw AgentEvents. Update the adapter task descriptions accordingly — the `app.emit("agent-stream", &agent_event)` pattern must become `app.emit("agent-stream", envelope_json)`.

- [ ] **Step 2: Add workflow command wrappers to tauri.ts**

Add to the `commands` object in `src/lib/tauri.ts`:

```typescript
// ── Workflow execution commands ──
startPipeline: (pipelineId: string) =>
  invoke<string>("start_pipeline", { pipelineId }),

advanceGate: (pipelineRunId: string) =>
  invoke<void>("advance_gate", { pipelineRunId }),

getPipelineRunStatus: (pipelineRunId: string) =>
  invoke<{
    pipeline_run_id: string;
    status: string;
    current_phase: { phase_run_id: string; phase_id: string; label: string; status: string; artifact_path: string | null; summary: string | null } | null;
    completed_phases: { phase_run_id: string; phase_id: string; label: string; status: string; artifact_path: string | null; summary: string | null }[];
  }>("get_pipeline_run_status", { pipelineRunId }),
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAgentStream.ts src/lib/tauri.ts
git commit -m "feat: add CLI source handling to useAgentStream, add workflow command wrappers"
```

### Task 11: Full build + test verification

- [ ] **Step 1: Run Rust tests**

Run: `npm run test:rust`
Expected: All Rust tests pass (including new codex_event_stream tests).

- [ ] **Step 2: Run frontend tests**

Run: `npm run test`
Expected: All frontend tests pass.

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Builds successfully.

- [ ] **Step 4: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: No errors.
