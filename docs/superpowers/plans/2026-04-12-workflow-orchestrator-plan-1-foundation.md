# Workflow Orchestrator — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish backend-agnostic session abstractions, migrate projects to SQLite, create pipeline data model, and load framework manifests — the prerequisite foundation for multi-backend workflow orchestration.

**Architecture:** Rename all Claude-specific types/state to generic "agent" naming across Rust and TypeScript. Add SQLite migration v9 with projects + pipeline tables. Framework manifests are static JSON loaded at startup.

**Tech Stack:** Rust (rusqlite, serde), TypeScript (Zustand), Tauri IPC

**Spec:** `docs/superpowers/specs/2026-04-12-multi-backend-workflow-orchestrator-design.md`

**Sequencing:** This is Plan 1 of 3. Plan 2 (adapters + engine) and Plan 3 (frontend UI) depend on this.

---

## File Map

### Rust — Modified
- `src-tauri/src/services/event_stream.rs` — Rename `claude_session_id` → `agent_session_id`
- `src-tauri/src/commands/claude_commands.rs` — Update field references to `agent_session_id`
- `src-tauri/src/db.rs` — Add migration v9 (projects, pipeline, pipeline_phase, pipeline_run, phase_run tables)
- `src-tauri/src/lib.rs` — Register new commands, add `backends` and `workflow` module stubs
- `src-tauri/src/commands/mod.rs` — Export new project_commands and pipeline_commands modules

### Rust — Created
- `src-tauri/src/commands/project_commands.rs` — CRUD for projects table
- `src-tauri/src/commands/pipeline_commands.rs` — CRUD for pipeline + pipeline_phase tables
- `src-tauri/src/backends/mod.rs` — BackendAdapter trait definition + framework manifest loader
- `src-tauri/src/workflow/mod.rs` — Module stub (empty, for Plan 2)
- `src-tauri/frameworks/superpowers.json` — Superpowers manifest
- `src-tauri/frameworks/gsd.json` — GSD manifest
- `src-tauri/frameworks/native.json` — Native manifest

### TypeScript — Modified
- `src/stores/types.ts` — Rename `ClaudeSessionState` → `AgentSessionState`, `ClaudeTask` → `AgentTask`, add pipeline types, update `Project` type
- `src/stores/slices/agentSlice.ts` — Rename all `claude*` state/methods to `agent*` equivalents
- `src/stores/slices/agentSlice.test.ts` — Update to match renamed types
- `src/stores/slices/projectSlice.ts` — Rewrite to use SQLite-backed project CRUD
- `src/hooks/useAgentStream.ts` — Update store method references from `claude*` to `agent*`
- `src/hooks/useClaudeStream.ts` — Delete (already disabled)
- `src/lib/tauri.ts` — Add project + pipeline command wrappers, update Claude command types
- `src/App.tsx` — Remove disabled useClaudeStream import
- `src/components/panels/ClaudeChat.tsx` — Update store references
- `src/components/panels/SessionBrowser.tsx` — Update store references
- `src/components/panels/SessionTabs.tsx` — Update store references
- `src/components/layout/TitleBar.tsx` — Update store references
- `src/components/layout/StatusBar.tsx` — Update store references
- `src/components/home/HomeScreen.tsx` — Update store references
- `src/components/home/ProjectCard.tsx` — Update store references
- `src/components/home/EnhancedProjectCard.tsx` — Update store references
- `src/components/home/EnhancedProjectCard.test.tsx` — Update store references
- `src/components/conversation/ErrorCard.tsx` — Update store references
- `src/hooks/useNotifications.ts` — Update store references
- `src/lib/attention.ts` — Update store references
- `src/stores/slices/projectSlice.test.ts` — Update for SQLite-backed CRUD

### TypeScript — Created
- `src/stores/slices/pipelineSlice.ts` — Zustand slice for pipeline state

---

## Milestone A: Agent Session Abstraction

### Task 1: Rename Rust AgentEvent field

**Files:**
- Modify: `src-tauri/src/services/event_stream.rs:20-35`

- [ ] **Step 1: Update the AgentEvent struct**

In `src-tauri/src/services/event_stream.rs`, rename the field and method:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentEvent {
    pub timestamp: String,
    pub event_type: AgentEventType,
    pub content: String,
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_session_id: Option<String>,
}

impl AgentEvent {
    /// Tag this event with a session ID for frontend routing.
    pub fn with_session_id(mut self, id: &str) -> Self {
        self.agent_session_id = Some(id.to_string());
        self
    }
}
```

- [ ] **Step 2: Update make_event to use new field name**

In the same file, update `make_event` (line ~351):

```rust
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
```

- [ ] **Step 3: Run Rust tests to verify**

Run: `cargo test --lib -p vibe-os -- event_stream`
Expected: All 20 event_stream tests pass. The field rename doesn't affect serialization because `claude_session_id` was only used internally.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/services/event_stream.rs
git commit -m "refactor: rename claude_session_id to agent_session_id in AgentEvent"
```

### Task 2: Update claude_commands.rs references

**Files:**
- Modify: `src-tauri/src/commands/claude_commands.rs`

- [ ] **Step 1: Update StartClaudeArgs field name**

In `src-tauri/src/commands/claude_commands.rs`, rename `claude_session_id` to `agent_session_id` in the args struct (line ~27):

```rust
#[derive(Debug, Deserialize)]
pub struct StartClaudeArgs {
    pub working_dir: String,
    pub message: String,
    pub system_prompt: Option<String>,
    pub conversation_id: Option<String>,
    pub agent_session_id: String,
}
```

- [ ] **Step 2: Update all references in start_claude function**

Replace every occurrence of `args.claude_session_id` with `args.agent_session_id` and `claude_sid` with `session_id` throughout the file. Key locations:
- Line ~92: `eprintln!("[vibe-os] Session ID: {}", &args.agent_session_id);`
- Line ~114: `let session_id = args.agent_session_id.clone();`
- Line ~122-131: The status emit should use `"agent_session_id"` key
- All thread spawns that capture `claude_sid` → `session_id`

Also update the `ClaudeProcesses` type alias comment:

```rust
/// Managed state for active CLI processes.
/// Key: agent_session_id, Value: the Child handle.
pub type ClaudeProcesses = Arc<TokioMutex<HashMap<String, Child>>>;
```

- [ ] **Step 3: Update cancel_claude and send_message commands**

Update parameter names from `claude_session_id` to `agent_session_id` in `cancel_claude` and `send_message` functions. The `#[tauri::command]` attribute uses the parameter names as the IPC argument keys, so the frontend must also be updated (Task 5).

- [ ] **Step 4: Build to verify**

Run: `cargo build -p vibe-os`
Expected: Compiles with no errors. There will be frontend IPC mismatches until Task 5, but the Rust side is self-consistent.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/claude_commands.rs
git commit -m "refactor: rename claude_session_id to agent_session_id in claude_commands"
```

### Task 3: Rename frontend types

**Files:**
- Modify: `src/stores/types.ts`

- [ ] **Step 1: Rename ClaudeSessionState to AgentSessionState**

In `src/stores/types.ts`, rename the interface (line ~311) and add a `backend` field:

```typescript
export interface AgentSessionState {
  id: string;
  name: string;
  backend: "claude" | "codex" | "sidecar";
  chatMessages: ChatMessage[];
  agentEvents: AgentEvent[];
  isWorking: boolean;
  conversationId: string | null;
  currentInvocationId: string | null;
  agentError: string | null;
  needsInput: boolean;
  attentionPreview: string | null;
  attentionMessageId: string | null;
  status: "idle" | "working" | "needs-input" | "error";
  createdAt: string;
  currentActivityMessageId: string | null;
  previewUrl: string | null;
  testSummary: TestSummary | null;
  buildStatus: BuildStatus;
  buildStatusText: string | null;
  apiMetrics: ApiMetrics | null;
  tasks: AgentTask[];
}
```

- [ ] **Step 2: Rename ClaudeTask to AgentTask**

In the same file, rename the interface (line ~280):

```typescript
export interface AgentTask {
  id: string;
  subject: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "deleted";
  owner: string | null;
  createdAt: string;
}
```

- [ ] **Step 3: Rename AgentSlice store accessors**

Update the `AgentSlice` interface (line ~334). Replace all `claude*` names:

```typescript
export interface AgentSlice {
  // CLI availability
  cliAvailable: Record<string, boolean | null>; // keyed by backend name
  cliError: Record<string, string | null>;
  validateCli: (backend?: string) => Promise<void>;

  // Per-session state
  agentSessions: Map<string, AgentSessionState>;
  activeSessionId: string | null;

  // Session lifecycle
  createSessionLocal: (id: string, name: string, backend?: "claude" | "codex" | "sidecar") => void;
  removeSession: (id: string) => void;
  setActiveSessionId: (id: string | null) => void;
  renameSession: (id: string, name: string) => void;

  // Session-scoped mutations (unchanged names — these are already generic)
  addSessionChatMessage: (sessionId: string, message: ChatMessage) => void;
  addSessionAgentEvent: (sessionId: string, event: AgentEvent) => void;
  appendToSessionLastAssistant: (sessionId: string, text: string) => void;
  setSessionWorking: (sessionId: string, working: boolean) => void;
  setSessionConversationId: (sessionId: string, id: string | null) => void;
  setSessionInvocationId: (sessionId: string, id: string | null) => void;
  setSessionError: (sessionId: string, error: string | null) => void;
  setSessionNeedsInput: (sessionId: string, needsInput: boolean) => void;
  clearSessionChat: (sessionId: string) => void;

  // Attention tracking (unchanged)
  setSessionAttention: (sessionId: string, preview: string | null, messageId: string | null) => void;
  clearSessionAttention: (sessionId: string) => void;

  // Rich card methods (unchanged)
  upsertActivityLine: (sessionId: string, event: AgentEvent) => void;
  finalizeActivityLine: (sessionId: string) => void;
  insertRichCard: (sessionId: string, cardType: CardType, content: string, cardData: Record<string, unknown>) => void;

  // Outcome state methods (unchanged)
  setSessionPreviewUrl: (sessionId: string, url: string | null) => void;
  setSessionTestSummary: (sessionId: string, summary: TestSummary | null) => void;
  setSessionBuildStatus: (sessionId: string, status: BuildStatus, text: string | null) => void;
  setSessionApiMetrics: (sessionId: string, metrics: ApiMetrics) => void;

  // Task tracking
  upsertSessionTask: (sessionId: string, task: AgentTask) => void;
  updateSessionTaskStatus: (sessionId: string, taskId: string, status: AgentTask["status"]) => void;

  // Legacy compat (delegate to active session)
  chatMessages: ChatMessage[];
  agentEvents: AgentEvent[];
  isWorking: boolean;
  conversationId: string | null;
  currentInvocationId: string | null;
  agentError: string | null;
  addChatMessage: (message: ChatMessage) => void;
  addAgentEvent: (event: AgentEvent) => void;
  appendToLastAssistant: (text: string) => void;
  setWorking: (working: boolean) => void;
  setConversationId: (id: string | null) => void;
  setCurrentInvocationId: (id: string | null) => void;
  setAgentError: (error: string | null) => void;
  clearChat: () => void;
}
```

- [ ] **Step 4: Update Project type**

Replace `claudeSessionId` with `activeSessionId` in the `Project` interface (line ~496):

```typescript
export interface Project {
  id: string;
  name: string;
  workspacePath: string;
  activeSessionId: string;
  summary: string;
  createdAt: string;
  linkedRepoIds: string[];
  linkedSkillIds: string[];
  linkedAgentNames: string[];
}
```

Update `ProjectSlice.addProject` signature:

```typescript
addProject: (name: string, workspacePath: string, sessionId: string) => void;
```

- [ ] **Step 5: Verify TypeScript compiles (it won't yet — consumers need updating)**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors in agentSlice.ts, projectSlice.ts, useAgentStream.ts, and component files. This is correct — we fix those in the next tasks.

- [ ] **Step 6: Commit**

```bash
git add src/stores/types.ts
git commit -m "refactor: rename Claude-specific types to backend-agnostic agent types"
```

### Task 4: Update agentSlice implementation

**Files:**
- Modify: `src/stores/slices/agentSlice.ts`

- [ ] **Step 1: Update imports and helper function**

Replace the top of the file:

```typescript
import type {
  SliceCreator,
  AgentSlice,
  ChatMessage,
  AgentEvent,
  AgentSessionState,
  AgentTask,
  ActivityEvent,
  CardType,
  TestSummary,
  BuildStatus,
  ApiMetrics,
} from "../types";
import { commands } from "../../lib/tauri";

// ── Helpers ──

function createDefaultSession(id: string, name: string, backend: "claude" | "codex" | "sidecar" = "sidecar"): AgentSessionState {
  return {
    id,
    name,
    backend,
    chatMessages: [],
    agentEvents: [],
    isWorking: false,
    conversationId: null,
    currentInvocationId: null,
    agentError: null,
    needsInput: false,
    attentionPreview: null,
    attentionMessageId: null,
    status: "idle",
    createdAt: new Date().toISOString(),
    currentActivityMessageId: null,
    previewUrl: null,
    testSummary: null,
    buildStatus: "idle" as const,
    buildStatusText: null,
    apiMetrics: null,
    tasks: [],
  };
}
```

- [ ] **Step 2: Rename updateSession and deriveStatus helpers**

Update the type references in both helpers:

```typescript
function updateSession(
  sessions: Map<string, AgentSessionState>,
  sessionId: string,
  updater: (s: AgentSessionState) => Partial<AgentSessionState>,
): Map<string, AgentSessionState> {
  const existing = sessions.get(sessionId);
  if (!existing) return sessions;
  const next = new Map(sessions);
  const updated = { ...existing, ...updater(existing) };
  updated.status = deriveStatus(updated);
  next.set(sessionId, updated);
  return next;
}

function deriveStatus(
  s: AgentSessionState,
): AgentSessionState["status"] {
  if (s.agentError) return "error";
  if (s.needsInput) return "needs-input";
  if (s.isWorking) return "working";
  return "idle";
}
```

- [ ] **Step 3: Rename all slice state and methods**

In the `createAgentSlice` function, apply these renames throughout the entire file. This is a mechanical find-and-replace:

| Old | New |
|-----|-----|
| `claudeCliAvailable` | — (replace with `cliAvailable: {}`) |
| `claudeCliError` | — (replace with `cliError: {}`) |
| `validateClaudeCli` | `validateCli` |
| `claudeSessions` | `agentSessions` |
| `activeClaudeSessionId` | `activeSessionId` |
| `createClaudeSessionLocal` | `createSessionLocal` |
| `removeClaudeSession` | `removeSession` |
| `setActiveClaudeSessionId` | `setActiveSessionId` |
| `renameClaudeSession` | `renameSession` |
| `state.claudeSessions` | `state.agentSessions` |
| `state.activeClaudeSessionId` | `state.activeSessionId` |

The `validateCli` method signature changes to accept an optional backend:

```typescript
validateCli: async (backend = "claude") => {
  try {
    const version = await commands.validateClaudeCli();
    set((state) => ({
      cliAvailable: { ...state.cliAvailable, [backend]: true },
      cliError: { ...state.cliError, [backend]: null },
    }));
    console.log(`[vibe-os] ${backend} CLI validated:`, version);
  } catch (err) {
    const message =
      typeof err === "string" ? err : (err as Error)?.message ?? String(err);
    set((state) => ({
      cliAvailable: { ...state.cliAvailable, [backend]: false },
      cliError: { ...state.cliError, [backend]: message },
    }));
    console.warn(`[vibe-os] ${backend} CLI validation failed:`, message);
  }
},
```

The `createSessionLocal` method adds the backend parameter:

```typescript
createSessionLocal: (id: string, name: string, backend: "claude" | "codex" | "sidecar" = "sidecar") =>
  set((state) => {
    const next = new Map(state.agentSessions);
    next.set(id, createDefaultSession(id, name, backend));
    const activeId = state.activeSessionId ?? id;
    return { agentSessions: next, activeSessionId: activeId };
  }),
```

Apply the same `claudeSessions` → `agentSessions` and `activeClaudeSessionId` → `activeSessionId` rename to every method in the slice. There are ~30 occurrences.

- [ ] **Step 4: Update legacy compat methods**

Update the legacy methods at the bottom of the slice to use new names:

```typescript
addChatMessage: (message: ChatMessage) => {
  const { activeSessionId, addSessionChatMessage } = get();
  if (activeSessionId) {
    addSessionChatMessage(activeSessionId, message);
  }
},

addAgentEvent: (event: AgentEvent) => {
  const { activeSessionId, addSessionAgentEvent } = get();
  if (activeSessionId) {
    addSessionAgentEvent(activeSessionId, event);
  }
},

appendToLastAssistant: (text: string) => {
  const { activeSessionId, appendToSessionLastAssistant } = get();
  if (activeSessionId) {
    appendToSessionLastAssistant(activeSessionId, text);
  }
},

setWorking: (working: boolean) => {
  const { activeSessionId, setSessionWorking } = get();
  if (activeSessionId) {
    setSessionWorking(activeSessionId, working);
  } else {
    set({ isWorking: working });
  }
},

setConversationId: (id: string | null) => {
  const { activeSessionId, setSessionConversationId } = get();
  if (activeSessionId) {
    setSessionConversationId(activeSessionId, id);
  } else {
    set({ conversationId: id });
  }
},

setCurrentInvocationId: (id: string | null) => {
  const { activeSessionId, setSessionInvocationId } = get();
  if (activeSessionId) {
    setSessionInvocationId(activeSessionId, id);
  } else {
    set({ currentInvocationId: id });
  }
},

setAgentError: (error: string | null) => {
  const { activeSessionId, setSessionError } = get();
  if (activeSessionId) {
    setSessionError(activeSessionId, error);
  } else {
    set({ agentError: error });
  }
},

clearChat: () => {
  const { activeSessionId, clearSessionChat } = get();
  if (activeSessionId) {
    clearSessionChat(activeSessionId);
  } else {
    set({
      chatMessages: [],
      agentEvents: [],
      conversationId: null,
      currentInvocationId: null,
      agentError: null,
    });
  }
},
```

- [ ] **Step 5: Commit**

```bash
git add src/stores/slices/agentSlice.ts
git commit -m "refactor: rename agentSlice from Claude-specific to backend-agnostic naming"
```

### Task 5: Update useAgentStream and delete useClaudeStream

**Files:**
- Modify: `src/hooks/useAgentStream.ts`
- Delete: `src/hooks/useClaudeStream.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `source` discriminator to the AgentEventPayload**

In `src/hooks/useAgentStream.ts`, update the `AgentEventPayload` interface to support multiple sources:

```typescript
interface AgentEventPayload {
  type: "sdk_message" | "sidecar_ready" | "session_ended" | "error";
  source?: "cli-claude" | "cli-codex" | "sdk-sidecar";
  sessionId?: string;
  message?: SdkAssistantMessage | SdkResultMessage | Record<string, unknown>;
  error?: string;
}
```

- [ ] **Step 2: Update store references from `claude*` to `agent*`**

Update the store method calls (lines ~59-61):

```typescript
// Change from:
if (!store.claudeSessions.has(sid)) {
  store.createClaudeSessionLocal(sid, "Agent Session");
}
// To:
const source = data.source ?? "sdk-sidecar";
const backendType = source === "cli-claude" ? "claude" : source === "cli-codex" ? "codex" : "sidecar";
if (!store.agentSessions.has(sid)) {
  store.createSessionLocal(sid, "Agent Session", backendType);
}
```

- [ ] **Step 3: Change event channel name**

Update the `listen` call to use the unified channel name `"agent-stream"` (line ~49):

```typescript
await listen<AgentEventPayload>("agent-stream", (event) => {
```

Note: The Rust sidecar code that emits `"agent-event"` must also be updated to emit `"agent-stream"`. This is a small change in `src-tauri/src/services/sidecar.rs` — find the `app.emit("agent-event", ...)` calls and change to `app.emit("agent-stream", ...)`.

- [ ] **Step 4: Add dispatch by source**

After the session existence check, add source-based dispatch. The existing SDK sidecar handling stays as-is but is wrapped in a source check:

```typescript
// Default source for backward compat during migration
const source = data.source ?? "sdk-sidecar";

if (source === "sdk-sidecar") {
  // Existing SDK sidecar handling (unchanged logic)
  if (data.type === "sdk_message" && data.message) {
    // ... existing code ...
  }
  if (data.type === "session_ended") {
    store.setSessionWorking(sid, false);
  }
  if (data.type === "error") {
    store.setSessionError(sid, data.error || "Unknown error");
    store.setSessionWorking(sid, false);
  }
}
// CLI backend handling will be added in Plan 2
// (cli-claude and cli-codex sources dispatch through BackendAdapter normalization)
```

- [ ] **Step 5: Delete useClaudeStream**

Delete `src/hooks/useClaudeStream.ts` entirely.

- [ ] **Step 6: Clean up App.tsx**

In `src/App.tsx`, remove the disabled import comment (line ~15):

```typescript
// Remove this line:
// useClaudeStream(); // disabled — SDK sidecar is primary now
```

- [ ] **Step 7: Update sidecar.rs emit channel**

In `src-tauri/src/services/sidecar.rs`, replace all `app.emit("agent-event", ...)` with `app.emit("agent-stream", ...)`.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useAgentStream.ts src/App.tsx src-tauri/src/services/sidecar.rs
git rm src/hooks/useClaudeStream.ts
git commit -m "refactor: unify event channel to agent-stream, add source discriminator, delete useClaudeStream"
```

### Task 6: Update tauri.ts IPC wrappers

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Update startClaude args**

In `src/lib/tauri.ts`, update the `startClaude` command wrapper (line ~307):

```typescript
startClaude: (args: {
  working_dir: string;
  message: string;
  system_prompt?: string;
  conversation_id?: string;
  agent_session_id: string;
}) => invoke<string>("start_claude", { args }),
```

- [ ] **Step 2: Update sendMessage and cancelClaude**

```typescript
sendMessage: (args: {
  message: string;
  conversationId: string;
  workingDir: string;
  agentSessionId: string;
}) => invoke<string>("send_message", args),

cancelClaude: (agentSessionId: string) =>
  invoke<void>("cancel_claude", { agentSessionId }),
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "refactor: update tauri IPC wrappers to use agent_session_id"
```

### Task 7: Update all component store references

**Files:**
- Modify: 12 component/hook files that reference `claudeSessions` or `activeClaudeSessionId`

- [ ] **Step 1: Bulk find-and-replace across component files**

Apply these replacements across all files listed in the grep results:

| Old | New |
|-----|-----|
| `claudeSessions` | `agentSessions` |
| `activeClaudeSessionId` | `activeSessionId` |
| `createClaudeSessionLocal` | `createSessionLocal` |
| `removeClaudeSession` | `removeSession` |
| `setActiveClaudeSessionId` | `setActiveSessionId` |
| `renameClaudeSession` | `renameSession` |
| `claudeCliAvailable` | `cliAvailable` |
| `claudeCliError` | `cliError` |
| `validateClaudeCli` | `validateCli` |
| `claudeSessionId` (in Project references) | `activeSessionId` |

Files to update:
- `src/components/panels/ClaudeChat.tsx`
- `src/components/panels/SessionBrowser.tsx`
- `src/components/panels/SessionTabs.tsx`
- `src/components/layout/TitleBar.tsx`
- `src/components/layout/StatusBar.tsx`
- `src/components/home/HomeScreen.tsx`
- `src/components/home/ProjectCard.tsx`
- `src/components/home/EnhancedProjectCard.tsx`
- `src/components/conversation/ErrorCard.tsx`
- `src/hooks/useNotifications.ts`
- `src/lib/attention.ts`

Note: For `cliAvailable`, the old code uses `claudeCliAvailable` as a `boolean | null`. The new code uses `cliAvailable` as `Record<string, boolean | null>`. Update accessor patterns:
- Old: `s.claudeCliAvailable`
- New: `s.cliAvailable["claude"] ?? null`

- [ ] **Step 2: Update test files**

Apply the same renames to:
- `src/stores/slices/agentSlice.test.ts`
- `src/components/home/EnhancedProjectCard.test.tsx`

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Run frontend tests**

Run: `npm run test`
Expected: All ~43 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: update all components from Claude-specific to agent-generic naming"
```

---

## Milestone B: Data Model + Projects in SQLite

### Task 8: SQLite migration v9

**Files:**
- Modify: `src-tauri/src/db.rs`

- [ ] **Step 1: Add migration v9**

Append after the `version < 8` block (line ~241) in `src-tauri/src/db.rs`:

```rust
if version < 9 {
    conn.execute_batch(
        "BEGIN;
         CREATE TABLE IF NOT EXISTS projects (
             id TEXT PRIMARY KEY,
             name TEXT NOT NULL,
             workspace_path TEXT NOT NULL,
             summary TEXT DEFAULT '',
             created_at TEXT NOT NULL,
             updated_at TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS pipeline (
             id TEXT PRIMARY KEY,
             project_id TEXT NOT NULL REFERENCES projects(id),
             name TEXT NOT NULL DEFAULT 'Default',
             created_at TEXT NOT NULL,
             updated_at TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS pipeline_phase (
             id TEXT PRIMARY KEY,
             pipeline_id TEXT NOT NULL REFERENCES pipeline(id),
             position INTEGER NOT NULL,
             label TEXT NOT NULL,
             phase_type TEXT NOT NULL,
             backend TEXT NOT NULL,
             framework TEXT NOT NULL,
             model TEXT NOT NULL,
             custom_prompt TEXT,
             gate_after TEXT NOT NULL DEFAULT 'gated'
         );
         CREATE TABLE IF NOT EXISTS pipeline_run (
             id TEXT PRIMARY KEY,
             pipeline_id TEXT NOT NULL REFERENCES pipeline(id),
             status TEXT NOT NULL,
             started_at TEXT NOT NULL,
             completed_at TEXT
         );
         CREATE TABLE IF NOT EXISTS phase_run (
             id TEXT PRIMARY KEY,
             pipeline_run_id TEXT NOT NULL REFERENCES pipeline_run(id),
             phase_id TEXT NOT NULL REFERENCES pipeline_phase(id),
             session_id TEXT NOT NULL,
             status TEXT NOT NULL,
             artifact_path TEXT,
             summary TEXT,
             baseline_sha TEXT,
             baseline_worktree_path TEXT,
             started_at TEXT,
             completed_at TEXT
         );
         CREATE INDEX IF NOT EXISTS idx_pipeline_project
             ON pipeline(project_id);
         CREATE INDEX IF NOT EXISTS idx_pipeline_phase_pipeline
             ON pipeline_phase(pipeline_id);
         CREATE INDEX IF NOT EXISTS idx_pipeline_run_pipeline
             ON pipeline_run(pipeline_id);
         CREATE INDEX IF NOT EXISTS idx_phase_run_pipeline_run
             ON phase_run(pipeline_run_id);
         PRAGMA user_version = 9;
         COMMIT;",
    )
    .map_err(|e| format!("Migration v9 failed: {}", e))?;

    // Migrate existing projects from settings JSON into projects table
    let maybe_json: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'projects_list'",
            [],
            |row| row.get(0),
        )
        .ok();

    if let Some(json_str) = maybe_json {
        if let Ok(projects) = serde_json::from_str::<Vec<serde_json::Value>>(&json_str) {
            let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
            for project in projects {
                let id = project.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let name = project.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let workspace_path = project.get("workspacePath").and_then(|v| v.as_str()).unwrap_or("");
                let summary = project.get("summary").and_then(|v| v.as_str()).unwrap_or("");

                if !id.is_empty() && !name.is_empty() {
                    conn.execute(
                        "INSERT OR IGNORE INTO projects (id, name, workspace_path, summary, created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                        rusqlite::params![id, name, workspace_path, summary, now],
                    ).ok();
                }
            }
        }
        // Remove old settings key after migration
        conn.execute("DELETE FROM settings WHERE key = 'projects_list'", []).ok();
    }
}
```

- [ ] **Step 2: Build and run to verify migration**

Run: `cargo build -p vibe-os`
Expected: Compiles. On next app launch, migration v9 runs and creates all 5 new tables.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db.rs
git commit -m "feat: add SQLite migration v9 — projects, pipeline, phase_run tables"
```

### Task 9: Project CRUD commands

**Files:**
- Create: `src-tauri/src/commands/project_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create project_commands.rs**

Create `src-tauri/src/commands/project_commands.rs`:

```rust
use serde::{Deserialize, Serialize};
use super::db_commands::DbState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub workspace_path: String,
    pub summary: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub async fn create_project(
    db: tauri::State<'_, DbState>,
    name: String,
    workspace_path: String,
) -> Result<ProjectRow, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    conn.execute(
        "INSERT INTO projects (id, name, workspace_path, summary, created_at, updated_at)
         VALUES (?1, ?2, ?3, '', ?4, ?4)",
        rusqlite::params![id, name, workspace_path, now],
    )
    .map_err(|e| format!("Insert project failed: {}", e))?;

    Ok(ProjectRow {
        id,
        name,
        workspace_path,
        summary: String::new(),
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub async fn list_projects(
    db: tauri::State<'_, DbState>,
) -> Result<Vec<ProjectRow>, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let mut stmt = conn
        .prepare("SELECT id, name, workspace_path, summary, created_at, updated_at FROM projects ORDER BY created_at DESC")
        .map_err(|e| format!("Prepare failed: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                workspace_path: row.get(2)?,
                summary: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[tauri::command]
pub async fn update_project(
    db: tauri::State<'_, DbState>,
    id: String,
    name: Option<String>,
    summary: Option<String>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    if let Some(name) = name {
        conn.execute(
            "UPDATE projects SET name = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![name, now, id],
        )
        .map_err(|e| format!("Update name failed: {}", e))?;
    }
    if let Some(summary) = summary {
        conn.execute(
            "UPDATE projects SET summary = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![summary, now, id],
        )
        .map_err(|e| format!("Update summary failed: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_project(
    db: tauri::State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    // Cascade: delete phase_runs, pipeline_runs, pipeline_phases, pipelines, then project
    conn.execute_batch(&format!(
        "BEGIN;
         DELETE FROM phase_run WHERE pipeline_run_id IN (
             SELECT id FROM pipeline_run WHERE pipeline_id IN (
                 SELECT id FROM pipeline WHERE project_id = '{id}'
             )
         );
         DELETE FROM pipeline_run WHERE pipeline_id IN (
             SELECT id FROM pipeline WHERE project_id = '{id}'
         );
         DELETE FROM pipeline_phase WHERE pipeline_id IN (
             SELECT id FROM pipeline WHERE project_id = '{id}'
         );
         DELETE FROM pipeline WHERE project_id = '{id}';
         DELETE FROM projects WHERE id = '{id}';
         COMMIT;"
    ))
    .map_err(|e| format!("Delete project failed: {}", e))?;

    Ok(())
}
```

- [ ] **Step 2: Export in mod.rs**

Add to `src-tauri/src/commands/mod.rs`:

```rust
pub mod project_commands;
```

- [ ] **Step 3: Register commands in lib.rs**

Add `use commands::project_commands;` to the imports at the top of `src-tauri/src/lib.rs`, and add to the `generate_handler![]` macro:

```rust
project_commands::create_project,
project_commands::list_projects,
project_commands::update_project,
project_commands::delete_project,
```

- [ ] **Step 4: Build to verify**

Run: `cargo build -p vibe-os`
Expected: Compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/project_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add SQLite-backed project CRUD commands"
```

### Task 10: Pipeline CRUD commands

**Files:**
- Create: `src-tauri/src/commands/pipeline_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create pipeline_commands.rs**

Create `src-tauri/src/commands/pipeline_commands.rs`:

```rust
use serde::{Deserialize, Serialize};
use super::db_commands::DbState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PipelineRow {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PipelinePhaseRow {
    pub id: String,
    pub pipeline_id: String,
    pub position: i32,
    pub label: String,
    pub phase_type: String,
    pub backend: String,
    pub framework: String,
    pub model: String,
    pub custom_prompt: Option<String>,
    pub gate_after: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePipelineArgs {
    pub project_id: String,
    pub name: String,
    pub phases: Vec<CreatePhaseArgs>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePhaseArgs {
    pub label: String,
    pub phase_type: String,
    pub backend: String,
    pub framework: String,
    pub model: String,
    pub custom_prompt: Option<String>,
    pub gate_after: String,
}

#[tauri::command]
pub async fn create_pipeline(
    db: tauri::State<'_, DbState>,
    args: CreatePipelineArgs,
) -> Result<PipelineRow, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let pipeline_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    conn.execute(
        "INSERT INTO pipeline (id, project_id, name, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)",
        rusqlite::params![pipeline_id, args.project_id, args.name, now],
    )
    .map_err(|e| format!("Insert pipeline failed: {}", e))?;

    for (i, phase) in args.phases.iter().enumerate() {
        let phase_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO pipeline_phase (id, pipeline_id, position, label, phase_type, backend, framework, model, custom_prompt, gate_after)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                phase_id,
                pipeline_id,
                i as i32,
                phase.label,
                phase.phase_type,
                phase.backend,
                phase.framework,
                phase.model,
                phase.custom_prompt,
                phase.gate_after,
            ],
        )
        .map_err(|e| format!("Insert phase failed: {}", e))?;
    }

    Ok(PipelineRow {
        id: pipeline_id,
        project_id: args.project_id,
        name: args.name,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub async fn get_project_pipeline(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Option<PipelineRow>, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let result = conn
        .query_row(
            "SELECT id, project_id, name, created_at, updated_at FROM pipeline WHERE project_id = ?1 LIMIT 1",
            rusqlite::params![project_id],
            |row| {
                Ok(PipelineRow {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            },
        )
        .ok();

    Ok(result)
}

#[tauri::command]
pub async fn get_pipeline_phases(
    db: tauri::State<'_, DbState>,
    pipeline_id: String,
) -> Result<Vec<PipelinePhaseRow>, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, pipeline_id, position, label, phase_type, backend, framework, model, custom_prompt, gate_after
             FROM pipeline_phase WHERE pipeline_id = ?1 ORDER BY position",
        )
        .map_err(|e| format!("Prepare failed: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![pipeline_id], |row| {
            Ok(PipelinePhaseRow {
                id: row.get(0)?,
                pipeline_id: row.get(1)?,
                position: row.get(2)?,
                label: row.get(3)?,
                phase_type: row.get(4)?,
                backend: row.get(5)?,
                framework: row.get(6)?,
                model: row.get(7)?,
                custom_prompt: row.get(8)?,
                gate_after: row.get(9)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[tauri::command]
pub async fn update_pipeline_phases(
    db: tauri::State<'_, DbState>,
    pipeline_id: String,
    phases: Vec<CreatePhaseArgs>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    // Delete existing phases and re-insert (simpler than diffing)
    conn.execute(
        "DELETE FROM pipeline_phase WHERE pipeline_id = ?1",
        rusqlite::params![pipeline_id],
    )
    .map_err(|e| format!("Delete phases failed: {}", e))?;

    for (i, phase) in phases.iter().enumerate() {
        let phase_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO pipeline_phase (id, pipeline_id, position, label, phase_type, backend, framework, model, custom_prompt, gate_after)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                phase_id,
                pipeline_id,
                i as i32,
                phase.label,
                phase.phase_type,
                phase.backend,
                phase.framework,
                phase.model,
                phase.custom_prompt,
                phase.gate_after,
            ],
        )
        .map_err(|e| format!("Insert phase failed: {}", e))?;
    }

    conn.execute(
        "UPDATE pipeline SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, pipeline_id],
    )
    .map_err(|e| format!("Update pipeline timestamp failed: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_pipeline(
    db: tauri::State<'_, DbState>,
    pipeline_id: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    conn.execute_batch(&format!(
        "BEGIN;
         DELETE FROM phase_run WHERE pipeline_run_id IN (
             SELECT id FROM pipeline_run WHERE pipeline_id = '{pipeline_id}'
         );
         DELETE FROM pipeline_run WHERE pipeline_id = '{pipeline_id}';
         DELETE FROM pipeline_phase WHERE pipeline_id = '{pipeline_id}';
         DELETE FROM pipeline WHERE id = '{pipeline_id}';
         COMMIT;"
    ))
    .map_err(|e| format!("Delete pipeline failed: {}", e))?;

    Ok(())
}
```

- [ ] **Step 2: Export in mod.rs**

Add to `src-tauri/src/commands/mod.rs`:

```rust
pub mod pipeline_commands;
```

- [ ] **Step 3: Register commands in lib.rs**

Add `use commands::pipeline_commands;` and register in `generate_handler![]`:

```rust
pipeline_commands::create_pipeline,
pipeline_commands::get_project_pipeline,
pipeline_commands::get_pipeline_phases,
pipeline_commands::update_pipeline_phases,
pipeline_commands::delete_pipeline,
```

- [ ] **Step 4: Build to verify**

Run: `cargo build -p vibe-os`
Expected: Compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/pipeline_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add pipeline CRUD commands for workflow builder"
```

### Task 11: Rewrite projectSlice to use SQLite

**Files:**
- Modify: `src/stores/slices/projectSlice.ts`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add project + pipeline command wrappers to tauri.ts**

Add to the `commands` object in `src/lib/tauri.ts`:

```typescript
// ── Project commands ──
createProject: (name: string, workspacePath: string) =>
  invoke<{ id: string; name: string; workspace_path: string; summary: string; created_at: string; updated_at: string }>("create_project", { name, workspacePath }),

listProjects: () =>
  invoke<{ id: string; name: string; workspace_path: string; summary: string; created_at: string; updated_at: string }[]>("list_projects"),

updateProject: (id: string, name?: string, summary?: string) =>
  invoke<void>("update_project", { id, name: name ?? null, summary: summary ?? null }),

deleteProject: (id: string) =>
  invoke<void>("delete_project", { id }),

// ── Pipeline commands ──
createPipeline: (args: {
  project_id: string;
  name: string;
  phases: {
    label: string;
    phase_type: string;
    backend: string;
    framework: string;
    model: string;
    custom_prompt: string | null;
    gate_after: string;
  }[];
}) => invoke<{ id: string; project_id: string; name: string; created_at: string; updated_at: string }>("create_pipeline", { args }),

getProjectPipeline: (projectId: string) =>
  invoke<{ id: string; project_id: string; name: string; created_at: string; updated_at: string } | null>("get_project_pipeline", { projectId }),

getPipelinePhases: (pipelineId: string) =>
  invoke<{ id: string; pipeline_id: string; position: number; label: string; phase_type: string; backend: string; framework: string; model: string; custom_prompt: string | null; gate_after: string }[]>("get_pipeline_phases", { pipelineId }),

updatePipelinePhases: (pipelineId: string, phases: {
  label: string;
  phase_type: string;
  backend: string;
  framework: string;
  model: string;
  custom_prompt: string | null;
  gate_after: string;
}[]) => invoke<void>("update_pipeline_phases", { pipelineId, phases }),

deletePipeline: (pipelineId: string) =>
  invoke<void>("delete_pipeline", { pipelineId }),
```

- [ ] **Step 2: Rewrite projectSlice.ts**

Replace `src/stores/slices/projectSlice.ts` entirely:

```typescript
import type { SliceCreator, ProjectSlice, Project } from "../types";
import { commands } from "../../lib/tauri";

const MAX_PROJECTS = 20;

export const createProjectSlice: SliceCreator<ProjectSlice> = (set, get) => ({
  projects: [],
  activeProjectId: null,
  currentView: "home",

  addProject: async (name, workspacePath, sessionId) => {
    const { projects } = get();
    if (projects.length >= MAX_PROJECTS) return;

    try {
      const row = await commands.createProject(name, workspacePath);
      const project: Project = {
        id: row.id,
        name: row.name,
        workspacePath: row.workspace_path,
        activeSessionId: sessionId,
        summary: row.summary,
        createdAt: row.created_at,
        linkedRepoIds: [],
        linkedSkillIds: [],
        linkedAgentNames: [],
      };
      set({
        projects: [...get().projects, project],
        activeProjectId: project.id,
        currentView: "conversation",
      });
    } catch (err) {
      console.error("[vibe-os] Failed to create project:", err);
    }
  },

  removeProject: async (id) => {
    try {
      await commands.deleteProject(id);
      const next = get().projects.filter((p) => p.id !== id);
      set({ projects: next });
      if (get().activeProjectId === id) {
        set({ activeProjectId: null, currentView: "home" });
      }
    } catch (err) {
      console.error("[vibe-os] Failed to delete project:", err);
    }
  },

  clearAllProjects: () => {
    // Delete each project from SQLite
    const { projects } = get();
    for (const p of projects) {
      commands.deleteProject(p.id).catch(() => {});
    }
    set({ projects: [], activeProjectId: null, currentView: "home" });
  },

  updateProjectSummary: async (id, summary) => {
    try {
      await commands.updateProject(id, undefined, summary);
      const next = get().projects.map((p) =>
        p.id === id ? { ...p, summary } : p,
      );
      set({ projects: next });
    } catch (err) {
      console.error("[vibe-os] Failed to update project summary:", err);
    }
  },

  openProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;

    const repos: any[] = (get() as any).repos ?? [];
    const linkedSet = new Set(project.linkedRepoIds);
    const updatedRepos = repos.map((r) => ({
      ...r,
      active: linkedSet.has(r.id),
    }));
    set({ repos: updatedRepos, activeProjectId: id, currentView: "conversation" });

    (async () => {
      try {
        for (const repo of updatedRepos) {
          await commands.setRepoActive(repo.id, repo.active);
        }
        const recompose = (get() as any).recompose;
        if (typeof recompose === "function") {
          await recompose();
        }
      } catch (err) {
        console.error("Failed to update repos on project switch:", err);
      }
    })();
  },

  goHome: () => set({ currentView: "home" }),
  goToSetup: () => set({ currentView: "project-setup" }),

  loadProjects: async () => {
    try {
      const rows = await commands.listProjects();
      const projects: Project[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        workspacePath: r.workspace_path,
        activeSessionId: "",
        summary: r.summary,
        createdAt: r.created_at,
        linkedRepoIds: [],
        linkedSkillIds: [],
        linkedAgentNames: [],
      }));
      set({ projects });
    } catch {
      console.warn("[vibe-os] Failed to load projects");
    }
  },

  saveProjects: async () => {
    // No-op — projects are now persisted to SQLite on each mutation
  },
});
```

Note: `addProject` signature changes from sync to async. Update the `ProjectSlice` interface in `types.ts` if not already done:

```typescript
addProject: (name: string, workspacePath: string, sessionId: string) => void;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/stores/slices/projectSlice.ts src/lib/tauri.ts
git commit -m "feat: rewrite projectSlice to use SQLite-backed CRUD"
```

---

## Milestone C: Framework Manifests + Backend Trait Stubs

### Task 12: Create framework manifest files

**Files:**
- Create: `src-tauri/frameworks/superpowers.json`
- Create: `src-tauri/frameworks/gsd.json`
- Create: `src-tauri/frameworks/native.json`

- [ ] **Step 1: Create superpowers.json**

Create `src-tauri/frameworks/superpowers.json`:

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
    "verification": "superpowers:verification-before-completion",
    "review": "superpowers:requesting-code-review"
  }
}
```

- [ ] **Step 2: Create gsd.json**

Create `src-tauri/frameworks/gsd.json`:

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

- [ ] **Step 3: Create native.json**

Create `src-tauri/frameworks/native.json`:

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

- [ ] **Step 4: Commit**

```bash
git add src-tauri/frameworks/
git commit -m "feat: add framework manifest JSON files"
```

### Task 13: Backend trait + manifest loader in Rust

**Files:**
- Create: `src-tauri/src/backends/mod.rs`
- Create: `src-tauri/src/workflow/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create backends/mod.rs with trait definition and manifest loader**

Create `src-tauri/src/backends/mod.rs`:

```rust
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

// ── Backend Adapter Trait ──

/// Trait for CLI backend adapters (Claude, Codex, etc.)
/// Implementations live in separate files (claude.rs, codex.rs) — added in Plan 2.
pub trait BackendAdapter: Send + Sync {
    fn name(&self) -> &str;
    fn supported_models(&self) -> Vec<ModelInfo>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub backend: String,
}

// ── Framework Manifests ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkManifest {
    pub id: String,
    pub name: String,
    pub supported_backends: Vec<String>,
    pub supported_phases: Vec<String>,
    pub features: FrameworkFeatures,
    pub phase_skills: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkFeatures {
    pub visual_companion: bool,
    pub interactive_questions: bool,
}

/// Load all framework manifests from the bundled frameworks/ directory.
/// Falls back to embedded defaults if files aren't found.
pub fn load_manifests() -> Vec<FrameworkManifest> {
    let mut manifests = Vec::new();

    // Try loading from the bundled frameworks/ directory next to the executable
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()));

    let search_dirs = [
        exe_dir.as_ref().map(|d| d.join("frameworks")),
        // Development fallback: relative to cargo manifest
        Some(std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("frameworks")),
    ];

    for dir in search_dirs.iter().flatten() {
        if dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map(|e| e == "json").unwrap_or(false) {
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            if let Ok(manifest) = serde_json::from_str::<FrameworkManifest>(&content) {
                                manifests.push(manifest);
                            }
                        }
                    }
                }
            }
            if !manifests.is_empty() {
                break; // Found manifests, stop searching
            }
        }
    }

    manifests
}

// ── Tauri command to expose manifests to frontend ──

#[tauri::command]
pub fn list_frameworks() -> Vec<FrameworkManifest> {
    load_manifests()
}
```

- [ ] **Step 2: Create workflow/mod.rs stub**

Create `src-tauri/src/workflow/mod.rs`:

```rust
// Workflow engine — implemented in Plan 2.
// This module will contain:
// - runner.rs — phase execution, gate management
// - context.rs — artifact store, summary generation, handoff
// - interaction.rs — framework interaction routing
```

- [ ] **Step 3: Register modules and command in lib.rs**

Add to the top of `src-tauri/src/lib.rs`:

```rust
mod backends;
mod workflow;
```

Add to the `generate_handler![]` macro:

```rust
backends::list_frameworks,
```

- [ ] **Step 4: Add list_frameworks wrapper to tauri.ts**

Add to the `commands` object in `src/lib/tauri.ts`:

```typescript
// ── Framework commands ──
listFrameworks: () =>
  invoke<{
    id: string;
    name: string;
    supported_backends: string[];
    supported_phases: string[];
    features: { visual_companion: boolean; interactive_questions: boolean };
    phase_skills: Record<string, string>;
  }[]>("list_frameworks"),
```

- [ ] **Step 5: Build full project**

Run: `cargo build -p vibe-os`
Expected: Compiles with no errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/backends/ src-tauri/src/workflow/ src-tauri/src/lib.rs src/lib/tauri.ts
git commit -m "feat: add BackendAdapter trait, framework manifest loader, workflow module stub"
```

### Task 14: Full build + test verification

**Files:** None (verification only)

- [ ] **Step 1: Run Rust tests**

Run: `npm run test:rust`
Expected: All Rust tests pass.

- [ ] **Step 2: Run frontend tests**

Run: `npm run test`
Expected: All frontend tests pass.

- [ ] **Step 3: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Run full build**

Run: `npm run build`
Expected: Frontend builds successfully.

- [ ] **Step 5: Start dev mode and verify app works**

Run: `npm run tauri dev`
Expected: App launches, projects load from SQLite, sessions work as before. The rename from Claude-specific to agent-generic is invisible to the user — everything behaves identically.
