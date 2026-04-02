# Claude Code Integration Improvements — Ralph Plan

This plan improves VIBE OS's integration with Claude Code CLI by aligning with its actual internal formats, parsing richer events, and connecting to its session/task infrastructure.

## How This Plan Works

You are an autonomous agent running in a loop. Each time you start:

1. Read this file to find the next unchecked task
2. Implement it fully (code + tests if applicable)
3. Check the box by changing `- [ ]` to `- [x]`
4. Commit your work with a descriptive message
5. Exit — you'll be re-invoked to handle the next task

If ALL tasks are checked, output "RALPH_DONE" and exit.

## Rules

- Work from the repo root: `C:/Users/Thoma/vibe-os`
- Run `npm run test` after each task to verify no regressions (98 tests should pass)
- Commit after each completed task
- Do NOT proceed to the next task in the same invocation — exit after each one
- Read existing code before modifying it
- Follow patterns in CLAUDE.md

---

## Task 1: Align Agent Definition Format with Claude Code

- [x] **1a: Update Rust agent_commands.rs frontmatter parser**

In `src-tauri/src/commands/agent_commands.rs`, extend `AgentDefinition` struct and `parse_agent_md` to support these additional Claude Code frontmatter fields:

```rust
pub struct AgentDefinition {
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub tools: Vec<String>,
    pub created_at: String,
    pub source_session_id: String,
    // New fields matching Claude Code's format:
    pub model: Option<String>,           // model override or "inherit"
    pub permission_mode: Option<String>,  // access control
    pub disallowed_tools: Vec<String>,
    pub max_turns: Option<u32>,
    pub background: bool,
    pub isolation: Option<String>,        // "worktree" or "remote"
    pub memory: Option<String>,           // "user", "project", "local"
    pub skills: Vec<String>,              // preloaded skill names
    pub color: Option<String>,
}
```

Update `parse_agent_md` to parse these from frontmatter (e.g., `model:`, `permissionMode:`, `disallowedTools: [...]`, `maxTurns:`, `background:`, `isolation:`, `memory:`, `skills: [...]`, `color:`).

Update `save_agent_definition` to write these fields to the frontmatter when present.

- [x] **1b: Update TypeScript types and wrappers**

In `src/lib/tauri.ts`, update `AgentDefinitionRaw` to include the new optional fields:

```typescript
export interface AgentDefinitionRaw {
  name: string;
  description: string;
  system_prompt: string;
  tools: string[];
  created_at: string;
  source_session_id: string;
  model: string | null;
  permission_mode: string | null;
  disallowed_tools: string[];
  max_turns: number | null;
  background: boolean;
  isolation: string | null;
  memory: string | null;
  skills: string[];
  color: string | null;
}
```

Update the `saveAgentDefinition` command wrapper to accept and pass the new fields.

- [x] **1c: Update AgentDefinition in store types**

In `src/stores/types.ts`, update `AgentDefinition` interface to include:

```typescript
export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  createdAt: string;
  sourceSessionId: string;
  active: boolean;
  // New Claude Code-compatible fields:
  model: string | null;
  permissionMode: string | null;
  disallowedTools: string[];
  maxTurns: number | null;
  background: boolean;
  isolation: string | null;
  memory: string | null;
  skills: string[];
  color: string | null;
}
```

Update `agentDefinitionSlice.ts` to map the new fields when loading/saving.

- [x] **1d: Update AgentSaveDialog with new fields**

In `src/components/conversation/AgentSaveDialog.tsx`, add UI controls for the new fields:
- Model dropdown/input (text input with "inherit" as placeholder)
- Permission mode select (default, plan, auto, bypassPermissions)
- Max turns number input
- Background checkbox
- Isolation select (none, worktree, remote)
- Memory select (none, user, project, local)

Group these in a collapsible "Advanced" section so they don't overwhelm the basic save flow.

- [x] **1e: Dual-write agents to ~/.vibe-os/agents/ AND .claude/agents/**

In `src-tauri/src/commands/agent_commands.rs`, modify `save_agent_definition` to also write a copy to `.claude/agents/` in the active workspace directory (if a workspace is active). This makes saved agents immediately usable by Claude Code natively.

Add a new command `get_workspace_agent_dir(workspace_path: String) -> String` that returns the `.claude/agents/` path for a workspace.

The `save_agent_definition` command should accept an optional `workspace_path` parameter. When provided, it writes to both `~/.vibe-os/agents/` (global) and `{workspace_path}/.claude/agents/` (project-local).

---

## Task 2: Symlink/Copy Skills to ~/.claude/skills/

- [x] **2a: Add skill sync command**

In `src-tauri/src/commands/context_commands.rs`, add a new command:

```rust
#[tauri::command]
pub fn sync_skills_to_claude(workspace_path: Option<String>) -> Result<Vec<String>, String>
```

This command:
1. Reads all `.md` files from `~/.vibe-os/skills/`
2. Ensures `~/.claude/skills/` exists
3. For each skill file, copies it to `~/.claude/skills/` if not already there or if the source is newer
4. Returns the list of synced file names

Register this in `lib.rs` and add a TypeScript wrapper in `tauri.ts`.

- [x] **2b: Auto-sync on skill toggle**

In `src/stores/slices/skillSlice.ts`, after skills are discovered or toggled, call `commands.syncSkillsToClaude()` to keep `~/.claude/skills/` in sync. This should be fire-and-forget (don't block the UI).

- [x] **2c: Restructure skills to use SKILL.md format**

Claude Code expects skills in directory format: `skills/skill-name/SKILL.md`. Update `sync_skills_to_claude` to:
1. For each `.md` file in `~/.vibe-os/skills/`, create a directory `~/.claude/skills/{stem}/`
2. Copy the file as `SKILL.md` inside that directory
3. This makes skills discoverable by Claude Code's `loadSkillsDir` which looks for `SKILL.md` files in subdirectories

---

## Task 3: Parse Richer Stream Events

- [x] **3a: Add new event types**

In `src/stores/types.ts`, extend `AgentEventType` to include new event types:

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
  // New types:
  | "agent_spawn"
  | "agent_complete"
  | "task_create"
  | "task_update"
  | "api_metrics";
```

- [x] **3b: Parse subagent fork events in useClaudeStream**

In `src/hooks/useClaudeStream.ts`, add detection for subagent spawn events from Claude Code's stream. Look for events where:
- `tool_name` is "Agent" or "SendMessage"
- The content contains agent metadata (agentType, description, worktreePath)

When detected, create an `agent_spawn` event with metadata:
```typescript
{
  event_type: "agent_spawn",
  content: `Spawned: ${agentType}`,
  metadata: {
    agentType,
    description,
    worktreePath,
    model,
    isolation,
  }
}
```

Also detect agent completion — when a tool result comes back from an Agent tool use, emit `agent_complete`.

- [x] **3c: Parse task events**

Add detection for TaskCreate, TaskUpdate, TaskGet, TaskList tool uses in the stream. When detected:
- `task_create`: Extract task subject, description, status
- `task_update`: Extract taskId, new status, completion info

Store these as `AgentEvent`s with the new types. This enables the conversation UI to show task progress cards.

- [x] **3d: Parse API metrics**

Look for stream events containing token usage, cost, and timing data (TTFT - time to first token). When found, emit an `api_metrics` event:
```typescript
{
  event_type: "api_metrics",
  content: "API metrics",
  metadata: {
    inputTokens: number,
    outputTokens: number,
    cost: number,
    ttft: number, // milliseconds
  }
}
```

Update `setSessionTestSummary` or add a new `setSessionApiMetrics` method to track cumulative token/cost data per session.

---

## Task 4: Session Attach Support

- [x] **4a: Add list-sessions and attach-session commands**

In `src-tauri/src/commands/claude_commands.rs`, add two new commands:

```rust
#[tauri::command]
pub async fn list_claude_code_sessions() -> Result<Vec<ClaudeCodeSession>, String>
```

This runs `claude sessions list --json` (or parses `~/.claude/sessions/`) to get running/backgrounded Claude Code sessions.

```rust
#[tauri::command]
pub async fn attach_claude_code_session(session_id: String, claude_session_id: String) -> Result<String, String>
```

This runs `claude attach <session_id>` to reconnect to a backgrounded session, piping output through the same event stream as `start_claude`.

Define `ClaudeCodeSession`:
```rust
pub struct ClaudeCodeSession {
    pub id: String,
    pub status: String,
    pub created_at: String,
    pub working_dir: String,
}
```

Register both in `lib.rs` and add TypeScript wrappers.

- [x] **4b: Add session browser UI**

Create `src/components/panels/SessionBrowser.tsx`:
- Lists running Claude Code sessions from `list_claude_code_sessions()`
- Shows session ID, status, working directory, age
- "Attach" button connects to the session via `attach_claude_code_session()`
- Polls every 10 seconds for updated session list
- Empty state: "No active Claude Code sessions"

This component should be accessible from the project setup view or the settings drawer.

---

## Task 5: Surface Claude's Task System

- [x] **5a: Add task tracking to session state**

In `src/stores/types.ts`, add to `ClaudeSessionState`:

```typescript
export interface ClaudeTask {
  id: string;
  subject: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "deleted";
  owner: string | null;
  createdAt: string;
}
```

Add `tasks: ClaudeTask[]` to `ClaudeSessionState`.

In `src/stores/slices/agentSlice.ts`, add:
- `upsertSessionTask(sessionId: string, task: ClaudeTask): void`
- `updateSessionTaskStatus(sessionId: string, taskId: string, status: string): void`

- [x] **5b: Create TaskProgressCard component**

Create `src/components/conversation/TaskProgressCard.tsx`:
- Renders a compact card showing task progress for the active session
- Shows: task count, completed count, progress bar
- Lists individual tasks with status icons (pending=circle, in_progress=spinner, completed=check, deleted=x)
- Collapsible — shows summary by default, expand for full list
- Updates reactively as task events are parsed from the stream

- [ ] **5c: Wire task events to the card**

In `src/hooks/useClaudeStream.ts`, when `task_create` or `task_update` events are parsed (from Task 3c), call `upsertSessionTask` or `updateSessionTaskStatus` to update the store. The `TaskProgressCard` will reactively render.

Insert the `TaskProgressCard` into the conversation view — either as a sticky element at the top of the chat, or as a rich card inserted when the first task is created.

---

## Task 6: Bridge API Exploration (Research Only)

- [ ] **6a: Document bridge protocol**

Create `docs/bridge-api-research.md` documenting what you find about the Claude Code bridge protocol by examining:
- The CLI flags: `--daemon-worker`, `daemon`, `bridge`, `remote-control`
- How IDE extensions (VS Code, JetBrains) communicate with Claude Code
- What the bridge messaging format looks like
- Whether VIBE OS could use it instead of stdout parsing

This is research only — do NOT implement bridge integration yet. Just document:
1. How to start a bridge session
2. What messages flow between bridge client and server
3. What advantages this would have over stdout parsing
4. What the migration path would look like

---

## Done Criteria

When ALL tasks above are checked `[x]`, the plan is complete. Output "RALPH_DONE" and exit.
