# Native Agent Loop — Design Spec

Replace the Claude Code CLI wrapper with a native agent loop using the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), running as a Tauri Node sidecar, with graph-native context injection from SurrealDB and custom MCP tools that give Claude direct access to VIBE OS's knowledge graph.

## 1. Architecture

Three processes with clear responsibilities:

### Frontend (React/TypeScript)
- Renders chat, rich cards, agent events
- Sends user messages via Tauri `invoke("start_agent", ...)`
- Listens to `"agent-event"` Tauri event channel
- Receives typed `SDKMessage` objects directly — no classification heuristics

### Rust Backend (Tauri)
- SQLite + SurrealDB graph operations (unchanged)
- Context assembly: queries graph for provenance, session history, architecture context
- Spawns and manages Node sidecar via `tauri-plugin-shell` sidecar support
- Bridges sidecar stdout events → `"agent-event"` Tauri channel to frontend
- Handles tool request/response callbacks from sidecar
- File I/O, workspace management, audit trail (unchanged)

### Node Sidecar (`agent-sidecar/`)
- Imports `@anthropic-ai/claude-agent-sdk`
- Runs `query()` async generator loop per session
- Streams `SDKMessage` events to Rust via stdout JSON lines
- Receives commands from Rust via stdin JSON lines
- Owns session lifecycle (multi-turn streaming, resume, cancel)
- Exposes VIBE OS MCP tools to Claude via `createSdkMcpServer()`
- Tool implementations call back to Rust for graph data

### Communication Protocol

**Rust → Sidecar (stdin):**
```jsonl
{ "type": "start", "sessionId": "uuid", "prompt": "user message", "systemPrompt": "assembled context", "options": { "cwd": "/path", "resume": "session-id-or-null", "model": "sonnet", "permissionMode": "acceptEdits", "tools": { "type": "preset", "preset": "claude_code" }, "allowedTools": ["Read","Write","Edit","Bash","Glob","Grep","Agent","vibe_graph_provenance","vibe_graph_impact","vibe_record_decision","vibe_search_graph","vibe_session_context","vibe_architecture"], "maxTurns": 50, "settingSources": ["project"] } }
{ "type": "send", "sessionId": "uuid", "prompt": "follow-up message" }
{ "type": "cancel", "sessionId": "uuid" }
{ "type": "tool_response", "requestId": "uuid", "result": { "content": [{ "type": "text", "text": "..." }] } }
{ "type": "stop" }
```

**Sidecar → Rust (stdout):**
```jsonl
{ "type": "ready" }
{ "type": "sdk_message", "sessionId": "uuid", "message": <SDKMessage> }
{ "type": "tool_request", "requestId": "uuid", "tool": "vibe_graph_provenance", "input": { "functionId": "repo:module:fn" } }
{ "type": "session_ended", "sessionId": "uuid" }
{ "type": "error", "sessionId": "uuid", "error": "description" }
```

## 2. Node Sidecar Structure

New directory `agent-sidecar/` at the repo root:

```
agent-sidecar/
  package.json
  tsconfig.json
  src/
    main.ts         — stdin/stdout JSON line protocol, command dispatch
    session.ts      — wraps SDK query() lifecycle, event streaming
    tools.ts        — VIBE OS MCP tool definitions
    types.ts        — shared message types (command/event schemas)
```

### `package.json` dependencies
- `@anthropic-ai/claude-agent-sdk` — the SDK
- `zod` — schema validation for MCP tools

### `main.ts`
Entry point. Reads stdin line by line, parses JSON commands, dispatches to session manager. The `readline` interface processes one command at a time.

On startup, emits `{ "type": "ready" }` to stdout.

### `session.ts`
Manages active sessions:

```typescript
interface ActiveSession {
  sessionId: string;
  query: Query;
  abortController: AbortController;
}
```

Holds a `Map<string, ActiveSession>` (max 5 concurrent).

**Start:** Creates `query({ prompt, options })` with the assembled system prompt and tool config. Iterates the async generator in a loop, writing each `SDKMessage` to stdout as a JSON line.

**Send (multi-turn):** Uses `query.streamInput()` to feed follow-up messages into the existing conversation without creating a new query.

**Cancel:** Calls `query.close()` and removes from the map.

**Resume:** Passes `options.resume = sessionId` to reconnect to a persisted SDK session.

### `tools.ts`
Defines VIBE OS MCP tools using the SDK's `tool()` helper and `createSdkMcpServer()`. Each tool handler sends a `tool_request` to stdout and awaits the corresponding `tool_response` from stdin, using a promise map keyed by `requestId`.

### `types.ts`
Shared type definitions for the stdin/stdout protocol. These types are duplicated in Rust (as serde structs) and in the sidecar (as TypeScript interfaces).

## 3. Graph-Native Context Assembly

Before each `query()` call, Rust assembles context from SurrealDB and injects it into the system prompt sent to the sidecar.

### Context Layers

**Layer 1: Base context (existing)**
- Workspace CLAUDE.md content
- Session goal
- Active skills markdown (token-budgeted)
- Active repo summaries (token-budgeted)

**Layer 2: Provenance context (new)**

Triggered when the user's message references files or functions (detected via regex: file paths like `src/foo.ts`, function names like `handleCreate`).

For each referenced entity, Rust queries the graph:
- Recent decisions that modified it (`decision` → `modified` → `fn_def/module`)
- Skills that informed those decisions (`decision` → `informed_by` → `skill`)
- Related tickets (`decision` → `addresses` → `ticket`)
- Test coverage (`test` → `validated_by` → `fn_def`)

Formatted as a `## Provenance` section appended to the system prompt:
```
## Provenance: src/components/home/HomeScreen.tsx

### Recent decisions
- [2026-04-01] Redesigned home screen layout (confidence: 0.9, reversible: true)
  Rationale: Split project cards from resource catalog for cleaner UX
  Informed by: rust-patterns, tauri-commands skills

### Test coverage
- HomeScreen.test.tsx: 12 assertions (all passing)

### Dependencies
- Called by: MainLayout.tsx
- Calls: EnhancedProjectCard, NewProjectCard
```

**Layer 3: Session history context (new)**

For ongoing sessions, Rust queries the session's graph nodes:
- Actions taken so far (`action` → `occurred_in` → `session`)
- Decisions made and their confidence/impact
- Cumulative token usage

Formatted as a `## Session History` section.

**Layer 4: Architecture context (new)**

When the user's message involves structural changes (detected by keywords: "refactor", "move", "split", "rename", "extract", "merge"):
- Call graph neighborhood (1-2 hops from mentioned functions)
- Import chain
- Module boundaries

Formatted as a `## Architecture` section.

### Token Budgeting

New budget category `"graph"` with a configurable token allocation (default: 4000 tokens). The graph context is assembled, measured, and truncated if it exceeds budget.

Priority when over budget (highest first):
1. Recent decisions (most actionable)
2. Provenance traces (file-specific context)
3. Session history (general context)
4. Architecture (broadest, cut first)

The existing `compose_prompt()` function is extended with a new `graph_context: Option<String>` parameter that gets inserted between the skills section and the repo section.

### Implementation

New Rust function in `src-tauri/src/commands/`:

```rust
pub async fn assemble_agent_context(
    db: &Surreal<Db>,
    workspace_path: &str,
    user_message: &str,
    session_id: &str,
    graph_budget_tokens: u32,
) -> Result<String, String>
```

This function:
1. Extracts file/function references from the user message (regex)
2. Queries SurrealDB for provenance on each reference
3. Queries the session's action/decision history
4. Detects structural intent and queries architecture if needed
5. Formats and truncates to budget
6. Returns the assembled graph context string

## 4. Custom MCP Tools

The sidecar creates an in-process MCP server using `createSdkMcpServer()` with these tools:

### `vibe_graph_provenance`
**Purpose:** "Show me the history of this function"
**Input:** `{ functionId: string }` — qualified name like `"repo:module:fn_name"`
**Returns:** Decision chain, skill attribution, test coverage, modification timeline
**Rust handler:** Calls `graph::queries::get_provenance()`

### `vibe_graph_impact`
**Purpose:** "What would break if I change this?"
**Input:** `{ functionId: string }`
**Returns:** Direct callers, indirect callers (2-hop), dependent tickets, validating tests
**Rust handler:** Calls `graph::queries::get_impact()`

### `vibe_record_decision`
**Purpose:** Agent records why it made an architectural choice
**Input:** `{ decision: string, rationale: string, confidence: number, impactCategory: string, reversible: boolean, relatedFiles: string[], relatedTickets: string[] }`
**Returns:** Confirmation with decision ID
**Rust handler:** Calls `graph::population::populate_decision()` + `audit_commands::log_action()`

### `vibe_search_graph`
**Purpose:** Free-text search across the knowledge graph
**Input:** `{ query: string }`
**Returns:** Matching nodes (functions, modules, decisions, skills) with relevance
**Rust handler:** Calls `graph::queries::search()`

### `vibe_session_context`
**Purpose:** Get current session's action history and state
**Input:** `{ sessionId: string }`
**Returns:** Actions, decisions, token spend, files touched
**Rust handler:** Calls `graph::queries::get_session_report()`

### `vibe_architecture`
**Purpose:** Get module topology for a subsystem
**Input:** `{ entryPoint: string }` — a file path or module name
**Returns:** Module graph with imports, calls, dependencies
**Rust handler:** Calls `graph::queries::get_topology()` with filtering

### Tool Request/Response Flow

1. Claude calls `vibe_graph_provenance({ functionId: "vibe-os:HomeScreen.tsx:handleOpenProject" })`
2. Sidecar's MCP tool handler writes to stdout: `{ "type": "tool_request", "requestId": "abc", "tool": "vibe_graph_provenance", "input": { "functionId": "..." } }`
3. Sidecar awaits response (promise keyed by `requestId`)
4. Rust reads the request from sidecar stdout, dispatches to graph query
5. Rust writes to sidecar stdin: `{ "type": "tool_response", "requestId": "abc", "result": { "content": [{ "type": "text", "text": "..." }] } }`
6. Sidecar resolves the promise, returns result to SDK
7. SDK includes the tool result in the next API call to Claude

### Permission Gating

All 6 tools are listed in `allowedTools` — auto-approved, no permission prompts. They're all read-only except `vibe_record_decision`, which writes to the graph but is a safe operation (append-only, no destructive side effects).

## 5. Rust Backend Changes

### Removed
- `claude_commands::start_claude()` — CLI process spawning
- `claude_commands::send_message()` — CLI stdin messaging
- `claude_commands::cancel_claude()` — CLI process killing
- `claude_commands::list_claude_code_sessions()` — CLI session listing
- `claude_commands::attach_claude_code_session()` — CLI session attach
- `event_stream::parse_event()` — stream-json parsing logic
- `ClaudeProcesses` managed state type

### New Modules

**`src-tauri/src/services/sidecar.rs`** — Sidecar process management:
- `SidecarState` — `Arc<TokioMutex<Option<Child>>>` managed state
- `spawn_sidecar(app: &AppHandle)` — starts `agent-sidecar` via `tauri-plugin-shell`, returns process handle
- `send_to_sidecar(state: &SidecarState, command: SidecarCommand)` — writes JSON line to stdin
- `read_sidecar_events(app: AppHandle, state: SidecarState)` — background task that reads stdout, dispatches events:
  - `sdk_message` → emit as `"agent-event"` Tauri event
  - `tool_request` → dispatch to `tool_handler`, send `tool_response` back
  - `session_ended` → update DB session status
  - `error` → emit error event
- `stop_sidecar(state: &SidecarState)` — sends `stop` command, waits for exit

**`src-tauri/src/services/tool_handler.rs`** — Handles tool callbacks:
- `handle_tool_request(db, graph_db, request)` — match on tool name, dispatch to graph queries
- Returns `SidecarToolResponse` ready to serialize

**`src-tauri/src/commands/agent_commands_v2.rs`** — New Tauri commands (replaces claude_commands):
- `start_agent(session_id, prompt, workspace_path)`:
  1. Calls `assemble_agent_context()` to build graph-enriched system prompt
  2. Calls `compose_prompt()` for skills/repo context
  3. Merges into final system prompt
  4. Sends `start` command to sidecar
- `send_agent_message(session_id, prompt)`:
  1. Sends `send` command to sidecar with just the user's message. The system prompt is NOT re-assembled on follow-ups — it was set on session start. Graph context for follow-ups comes through the MCP tools (Claude can call `vibe_graph_provenance` etc. as needed during the conversation).
- `cancel_agent(session_id)`:
  1. Sends `cancel` command to sidecar
- `assemble_agent_context(workspace_path, user_message, session_id)`:
  1. Extracts references from user message
  2. Queries SurrealDB for provenance, session history, architecture
  3. Formats and budgets
  4. Returns context string

### Modified

**`src-tauri/src/lib.rs`:**
- Remove all `claude_commands::*` registrations
- Add `agent_commands_v2::*` registrations
- Add sidecar state initialization in `setup()`
- Spawn sidecar on app start, stop on app close

**`src-tauri/src/commands/mod.rs`:**
- Add `pub mod agent_commands_v2;`
- Keep `claude_commands` for now but mark deprecated (remove in next milestone)

### Unchanged
- `graph/schema.rs`, `graph/queries.rs`, `graph/population.rs`, `graph/indexer.rs`
- `db.rs`, `db_commands.rs`
- `context_commands.rs` (compose_prompt extended but not replaced)
- `file_commands.rs`, `workspace_commands.rs`
- `audit_commands.rs`, `decision_commands.rs`
- `agent_commands.rs` (agent definition CRUD — different from agent_commands_v2)

## 6. Frontend Changes

### New: `src/hooks/useAgentStream.ts`

Replaces `useClaudeStream.ts`. Listens to `"agent-event"` Tauri events.

Key difference: receives typed `SDKMessage` objects directly. No heuristic classification needed.

**Message type handling:**

| SDK Message Type | Frontend Action |
|---|---|
| `SDKAssistantMessage` | Extract `content` blocks: text → append to chat, `tool_use` → create activity card with tool name/input |
| `SDKUserMessage` | Add to chat (if not synthetic) |
| `SDKResultMessage` | Create outcome card with `total_cost_usd`, `usage`, `duration_ms`, `num_turns` |
| `SDKStatusMessage` | Update session status (working/idle) |
| `SDKTaskNotificationMessage` | Update task progress card |
| `SDKTaskStartedMessage` | Create task started card |
| `SDKTaskProgressMessage` | Update task progress |
| `SDKToolProgressMessage` | Update activity line with progress |
| `SDKPartialAssistantMessage` | Stream partial text for live typing effect |
| `SDKRateLimitEvent` | Show rate limit warning |
| `SDKPromptSuggestionMessage` | Show suggested follow-up prompt |

This is cleaner than the current approach because the SDK already classifies events — we just map them to UI updates.

### Modified: `src/components/panels/ClaudeChat.tsx`

- `handleSend()` calls `commands.startAgent()` / `commands.sendAgentMessage()` instead of `commands.startClaude()` / `commands.sendMessage()`
- `handleCancel()` calls `commands.cancelAgent()` instead of `commands.cancelClaude()`
- Remove CLI validation check — sidecar readiness is checked instead

### Modified: `src/lib/tauri.ts`

Remove:
- `startClaude`, `sendMessage`, `cancelClaude`
- `listClaudeCodeSessions`, `attachClaudeCodeSession`
- `validateClaudeCli`

Add:
- `startAgent(sessionId: string, prompt: string, workspacePath: string): Promise<void>`
- `sendAgentMessage(sessionId: string, prompt: string): Promise<void>`
- `cancelAgent(sessionId: string): Promise<void>`
- `getSidecarStatus(): Promise<"ready" | "starting" | "stopped">`

### Unchanged
- All other components, stores, slices
- The conversation UI structure (same chat + activity cards + rich cards)
- Settings panel, resource catalog, project setup

## 7. Session Management

### Multi-turn Conversations

The SDK's streaming input mode keeps a single `query()` alive across messages:

1. **First message:** Sidecar creates `query({ prompt, options })` with full config
2. **Follow-ups:** Sidecar calls `query.streamInput()` to feed new messages
3. **No new process per message** — the SDK manages the conversation internally

### Session Persistence

The SDK persists sessions natively to `~/.claude/sessions/` with `persistSession: true` (default). On app restart:
1. Rust sends `start` with `options.resume = previousSessionId`
2. SDK loads conversation from disk, replays context
3. Conversation continues seamlessly

### Concurrent Sessions

Map of `sessionId → ActiveSession` in the sidecar, max 5. Each session is independent — different system prompts, different graph context, different workspace.

### Lifecycle

| Event | Action |
|---|---|
| App launch | Rust spawns sidecar, waits for `ready` |
| User creates project | `start_agent()` creates session in sidecar |
| User sends message | `send_agent_message()` streams into existing session |
| User switches projects | Previous session stays alive, events still routed |
| User cancels | `cancel_agent()` → sidecar calls `query.close()` |
| App closes | Rust sends `stop` → sidecar closes all sessions gracefully |
| Sidecar crashes | Rust detects exit, auto-restarts, resumes active sessions |

## 8. Tauri Sidecar Configuration

In `tauri.conf.json`, register the sidecar:

```json
{
  "bundle": {
    "externalBin": ["agent-sidecar/dist/main"]
  }
}
```

The sidecar is built as a standalone Node.js script (bundled with esbuild or similar) that ships alongside the Tauri binary. On app start, Tauri's shell plugin spawns it.

Build step added to `package.json`:
```json
{
  "scripts": {
    "build:sidecar": "cd agent-sidecar && npm run build",
    "tauri dev": "npm run build:sidecar && tauri dev",
    "tauri build": "npm run build:sidecar && tauri build"
  }
}
```

## 9. Migration Path

The old Claude Code CLI integration is not removed immediately. During development:

1. Both paths coexist — `claude_commands.rs` (old) and `agent_commands_v2.rs` (new)
2. A feature flag or setting controls which path is used: `"agent_backend": "sdk" | "cli"`
3. Default starts as `"cli"` — switched to `"sdk"` once the sidecar is stable
4. Old path removed in a subsequent cleanup milestone

This allows incremental development and easy rollback.
