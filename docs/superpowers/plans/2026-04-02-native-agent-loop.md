# Native Agent Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Claude Code CLI wrapper with a native agent loop using the Claude Agent SDK running as a Tauri Node sidecar, with graph-native context injection and custom MCP tools.

**Architecture:** Node sidecar (`agent-sidecar/`) imports `@anthropic-ai/claude-agent-sdk` and communicates with the Rust backend via stdin/stdout JSON lines. Rust assembles graph context from SurrealDB before each query and handles tool callbacks. Frontend receives typed `SDKMessage` events directly.

**Tech Stack:** `@anthropic-ai/claude-agent-sdk`, Node.js 18+, Tauri 2 sidecar (`tauri-plugin-shell`), SurrealDB 3.0, React 18, Zustand 5, Zod (MCP tool schemas)

---

## File Structure

### New Files
- `agent-sidecar/package.json` — sidecar Node project
- `agent-sidecar/tsconfig.json` — strict ESM config
- `agent-sidecar/src/types.ts` — shared protocol types
- `agent-sidecar/src/main.ts` — stdin/stdout JSON line dispatcher
- `agent-sidecar/src/session.ts` — SDK query lifecycle manager
- `agent-sidecar/src/tools.ts` — VIBE OS MCP tool definitions
- `agent-sidecar/build.mjs` — esbuild script to bundle for sidecar
- `src-tauri/src/services/sidecar.rs` — sidecar process management
- `src-tauri/src/services/tool_handler.rs` — tool request dispatcher
- `src-tauri/src/commands/agent_commands_v2.rs` — new Tauri commands
- `src/hooks/useAgentStream.ts` — typed SDK event listener
- `src/lib/agentCommands.ts` — new command wrappers

### Modified Files
- `src-tauri/Cargo.toml` — no new deps needed (shell plugin already present)
- `src-tauri/src/lib.rs` — register new commands, sidecar state init
- `src-tauri/src/commands/mod.rs` — add agent_commands_v2 module
- `src-tauri/src/services/mod.rs` — add sidecar and tool_handler modules
- `src-tauri/tauri.conf.json` — add externalBin for sidecar
- `src/components/panels/ClaudeChat.tsx` — swap to new commands
- `src/stores/types.ts` — add sidecar status type
- `src/stores/slices/agentSlice.ts` — add sidecar status tracking
- `package.json` — add build:sidecar script

---

## Task 1: Scaffold the Node Sidecar Project

**Files:**
- Create: `agent-sidecar/package.json`
- Create: `agent-sidecar/tsconfig.json`
- Create: `agent-sidecar/src/types.ts`
- Create: `agent-sidecar/build.mjs`

- [ ] **Step 1: Create package.json**

Create `agent-sidecar/package.json`:

```json
{
  "name": "vibe-os-agent-sidecar",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/main.js",
  "scripts": {
    "build": "node build.mjs",
    "dev": "node build.mjs --watch"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "esbuild": "^0.25.0",
    "@types/node": "^22.0.0",
    "typescript": "~5.5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `agent-sidecar/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create shared protocol types**

Create `agent-sidecar/src/types.ts`:

```typescript
// ── Inbound commands (Rust → Sidecar via stdin) ──

export interface StartCommand {
  type: "start";
  sessionId: string;
  prompt: string;
  systemPrompt: string;
  options: {
    cwd: string;
    resume?: string;
    model?: string;
    permissionMode?: string;
    tools?: { type: "preset"; preset: "claude_code" } | string[];
    allowedTools?: string[];
    disallowedTools?: string[];
    maxTurns?: number;
    settingSources?: string[];
    effort?: "low" | "medium" | "high" | "max";
  };
}

export interface SendCommand {
  type: "send";
  sessionId: string;
  prompt: string;
}

export interface CancelCommand {
  type: "cancel";
  sessionId: string;
}

export interface ToolResponseCommand {
  type: "tool_response";
  requestId: string;
  result: { content: Array<{ type: "text"; text: string }> };
}

export interface StopCommand {
  type: "stop";
}

export type SidecarCommand =
  | StartCommand
  | SendCommand
  | CancelCommand
  | ToolResponseCommand
  | StopCommand;

// ── Outbound events (Sidecar → Rust via stdout) ──

export interface ReadyEvent {
  type: "ready";
}

export interface SdkMessageEvent {
  type: "sdk_message";
  sessionId: string;
  message: unknown; // SDKMessage — serialized as-is
}

export interface ToolRequestEvent {
  type: "tool_request";
  requestId: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface SessionEndedEvent {
  type: "session_ended";
  sessionId: string;
}

export interface ErrorEvent {
  type: "error";
  sessionId?: string;
  error: string;
}

export type SidecarEvent =
  | ReadyEvent
  | SdkMessageEvent
  | ToolRequestEvent
  | SessionEndedEvent
  | ErrorEvent;
```

- [ ] **Step 4: Create build script**

Create `agent-sidecar/build.mjs`:

```javascript
import { build } from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const opts = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "dist/main.mjs",
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
  external: ["@anthropic-ai/claude-agent-sdk"],
};

if (watch) {
  const ctx = await (await import("esbuild")).context(opts);
  await ctx.watch();
  console.log("Watching...");
} else {
  await build(opts);
  console.log("Built agent-sidecar/dist/main.mjs");
}
```

- [ ] **Step 5: Install dependencies and verify build**

```bash
cd agent-sidecar && npm install && npm run build
```

Expected: `dist/main.mjs` created (will be empty entry point until main.ts exists).

- [ ] **Step 6: Commit**

```bash
git add agent-sidecar/
git commit -m "feat: scaffold agent-sidecar Node project with protocol types"
```

---

## Task 2: Implement Sidecar Main Entry Point

**Files:**
- Create: `agent-sidecar/src/main.ts`

- [ ] **Step 1: Create main.ts**

Create `agent-sidecar/src/main.ts`:

```typescript
import * as readline from "node:readline";
import type { SidecarCommand, SidecarEvent } from "./types.js";
import { SessionManager } from "./session.js";

function emit(event: SidecarEvent): void {
  process.stdout.write(JSON.stringify(event) + "\n");
}

const sessions = new SessionManager(emit);

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", async (line: string) => {
  let cmd: SidecarCommand;
  try {
    cmd = JSON.parse(line);
  } catch {
    emit({ type: "error", error: `Invalid JSON: ${line}` });
    return;
  }

  try {
    switch (cmd.type) {
      case "start":
        await sessions.start(cmd);
        break;
      case "send":
        await sessions.send(cmd);
        break;
      case "cancel":
        sessions.cancel(cmd.sessionId);
        break;
      case "tool_response":
        sessions.resolveToolResponse(cmd.requestId, cmd.result);
        break;
      case "stop":
        sessions.closeAll();
        rl.close();
        process.exit(0);
        break;
    }
  } catch (err) {
    emit({
      type: "error",
      sessionId: "sessionId" in cmd ? (cmd as { sessionId: string }).sessionId : undefined,
      error: String(err),
    });
  }
});

// Signal ready
emit({ type: "ready" });
```

- [ ] **Step 2: Verify it compiles**

Note: This depends on `session.ts` which doesn't exist yet. Create a stub:

Create `agent-sidecar/src/session.ts`:

```typescript
import type {
  StartCommand,
  SendCommand,
  SidecarEvent,
  ToolResponseCommand,
} from "./types.js";

export class SessionManager {
  constructor(private emit: (event: SidecarEvent) => void) {}
  async start(cmd: StartCommand): Promise<void> { /* stub */ }
  async send(cmd: SendCommand): Promise<void> { /* stub */ }
  cancel(sessionId: string): void { /* stub */ }
  resolveToolResponse(requestId: string, result: ToolResponseCommand["result"]): void { /* stub */ }
  closeAll(): void { /* stub */ }
}
```

```bash
cd agent-sidecar && npm run build
```

Expected: builds without errors.

- [ ] **Step 3: Commit**

```bash
git add agent-sidecar/src/main.ts agent-sidecar/src/session.ts
git commit -m "feat: add sidecar main entry point with stdin/stdout protocol"
```

---

## Task 3: Implement Session Manager

**Files:**
- Modify: `agent-sidecar/src/session.ts` (replace stub)

- [ ] **Step 1: Implement SessionManager**

Replace `agent-sidecar/src/session.ts`:

```typescript
import { query, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type {
  StartCommand,
  SendCommand,
  SidecarEvent,
  ToolResponseCommand,
} from "./types.js";
import { createVibeTools, setToolResponseResolver } from "./tools.js";

interface ActiveSession {
  sessionId: string;
  query: Query;
  abortController: AbortController;
}

const MAX_SESSIONS = 5;

export class SessionManager {
  private sessions = new Map<string, ActiveSession>();
  private emit: (event: SidecarEvent) => void;

  constructor(emit: (event: SidecarEvent) => void) {
    this.emit = emit;
  }

  async start(cmd: StartCommand): Promise<void> {
    if (this.sessions.size >= MAX_SESSIONS) {
      this.emit({ type: "error", sessionId: cmd.sessionId, error: "Max sessions reached (5)" });
      return;
    }

    if (this.sessions.has(cmd.sessionId)) {
      this.emit({ type: "error", sessionId: cmd.sessionId, error: "Session already exists" });
      return;
    }

    const abortController = new AbortController();

    // Create VIBE OS MCP server with custom tools
    const vibeServer = createSdkMcpServer({
      name: "vibe-os",
      tools: createVibeTools(this.emit),
    });

    const allowedTools = [
      ...(cmd.options.allowedTools ?? []),
      "vibe_graph_provenance",
      "vibe_graph_impact",
      "vibe_record_decision",
      "vibe_search_graph",
      "vibe_session_context",
      "vibe_architecture",
    ];

    const q = query({
      prompt: cmd.prompt,
      options: {
        abortController,
        cwd: cmd.options.cwd,
        systemPrompt: cmd.systemPrompt
          ? { type: "preset" as const, preset: "claude_code" as const, append: cmd.systemPrompt }
          : { type: "preset" as const, preset: "claude_code" as const },
        resume: cmd.options.resume || undefined,
        model: cmd.options.model,
        permissionMode: (cmd.options.permissionMode as "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk" | "auto") || "acceptEdits",
        tools: cmd.options.tools ?? { type: "preset", preset: "claude_code" },
        allowedTools,
        disallowedTools: cmd.options.disallowedTools,
        maxTurns: cmd.options.maxTurns ?? 50,
        settingSources: (cmd.options.settingSources as ("user" | "project" | "local")[]) ?? ["project"],
        effort: cmd.options.effort ?? "high",
        mcpServers: { "vibe-os": vibeServer },
        sessionId: cmd.sessionId,
      },
    });

    const session: ActiveSession = { sessionId: cmd.sessionId, query: q, abortController };
    this.sessions.set(cmd.sessionId, session);

    // Stream messages in background
    this.consumeStream(session).catch((err) => {
      this.emit({ type: "error", sessionId: cmd.sessionId, error: String(err) });
    });
  }

  private async consumeStream(session: ActiveSession): Promise<void> {
    try {
      for await (const message of session.query) {
        this.emit({
          type: "sdk_message",
          sessionId: session.sessionId,
          message,
        });
      }
    } finally {
      this.sessions.delete(session.sessionId);
      this.emit({ type: "session_ended", sessionId: session.sessionId });
    }
  }

  async send(cmd: SendCommand): Promise<void> {
    const session = this.sessions.get(cmd.sessionId);
    if (!session) {
      this.emit({ type: "error", sessionId: cmd.sessionId, error: "Session not found" });
      return;
    }

    // Use streamInput for multi-turn
    const inputStream = async function* () {
      yield {
        type: "user" as const,
        session_id: cmd.sessionId,
        message: { role: "user" as const, content: cmd.prompt },
        parent_tool_use_id: null,
      };
    };

    await session.query.streamInput(inputStream());
  }

  cancel(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.query.close();
      this.sessions.delete(sessionId);
    }
  }

  resolveToolResponse(requestId: string, result: ToolResponseCommand["result"]): void {
    setToolResponseResolver(requestId, result);
  }

  closeAll(): void {
    for (const [id, session] of this.sessions) {
      session.query.close();
    }
    this.sessions.clear();
  }
}
```

- [ ] **Step 2: Build and verify**

```bash
cd agent-sidecar && npm run build
```

Expected: builds (tools.ts stub needed — create minimal stub if not exists).

- [ ] **Step 3: Commit**

```bash
git add agent-sidecar/src/session.ts
git commit -m "feat: implement SessionManager with SDK query lifecycle"
```

---

## Task 4: Implement MCP Tools

**Files:**
- Create: `agent-sidecar/src/tools.ts`

- [ ] **Step 1: Create tools.ts**

Create `agent-sidecar/src/tools.ts`:

```typescript
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { SidecarEvent, ToolResponseCommand } from "./types.js";

// Pending tool response resolvers
const pendingToolResponses = new Map<
  string,
  (result: ToolResponseCommand["result"]) => void
>();

export function setToolResponseResolver(
  requestId: string,
  result: ToolResponseCommand["result"],
): void {
  const resolver = pendingToolResponses.get(requestId);
  if (resolver) {
    resolver(result);
    pendingToolResponses.delete(requestId);
  }
}

function requestTool(
  emit: (event: SidecarEvent) => void,
  toolName: string,
  input: Record<string, unknown>,
): Promise<ToolResponseCommand["result"]> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    pendingToolResponses.set(requestId, resolve);
    emit({
      type: "tool_request",
      requestId,
      tool: toolName,
      input,
    });
  });
}

export function createVibeTools(emit: (event: SidecarEvent) => void) {
  return [
    tool(
      "vibe_graph_provenance",
      "Get the decision history, skill attribution, test coverage, and modification timeline for a function. Use this to understand WHY code exists and WHO changed it.",
      { functionId: z.string().describe("Qualified function ID like 'repo:module:fn_name'") },
      async ({ functionId }) => {
        const result = await requestTool(emit, "vibe_graph_provenance", { functionId });
        return result;
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "vibe_graph_impact",
      "Get the impact radius of changing a function — direct callers, indirect callers, dependent tickets, and validating tests. Use this before making changes to understand what might break.",
      { functionId: z.string().describe("Qualified function ID like 'repo:module:fn_name'") },
      async ({ functionId }) => {
        const result = await requestTool(emit, "vibe_graph_impact", { functionId });
        return result;
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "vibe_record_decision",
      "Record an architectural decision with rationale, confidence, and impact category. This persists your reasoning into the knowledge graph for future sessions.",
      {
        decision: z.string().describe("What was decided"),
        rationale: z.string().describe("Why this decision was made"),
        confidence: z.number().min(0).max(1).describe("Confidence level 0-1"),
        impactCategory: z.enum(["perf", "accuracy", "dx", "security", "architecture"]),
        reversible: z.boolean().describe("Whether this decision is easily reversible"),
        relatedFiles: z.array(z.string()).optional().describe("File paths affected"),
        relatedTickets: z.array(z.string()).optional().describe("Related ticket IDs"),
      },
      async (args) => {
        const result = await requestTool(emit, "vibe_record_decision", args);
        return result;
      },
    ),

    tool(
      "vibe_search_graph",
      "Search the knowledge graph for functions, modules, decisions, or skills matching a query.",
      { query: z.string().describe("Search query") },
      async ({ query }) => {
        const result = await requestTool(emit, "vibe_search_graph", { query });
        return result;
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "vibe_session_context",
      "Get the current session's action history, decisions made, token spend, and files touched.",
      { sessionId: z.string().describe("Session UUID") },
      async ({ sessionId }) => {
        const result = await requestTool(emit, "vibe_session_context", { sessionId });
        return result;
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "vibe_architecture",
      "Get module topology — imports, call graph, and dependency relationships for a subsystem.",
      { entryPoint: z.string().describe("File path or module name to center the topology on") },
      async ({ entryPoint }) => {
        const result = await requestTool(emit, "vibe_architecture", { entryPoint });
        return result;
      },
      { annotations: { readOnlyHint: true } },
    ),
  ];
}
```

- [ ] **Step 2: Build full sidecar**

```bash
cd agent-sidecar && npm run build
```

Expected: `dist/main.mjs` built successfully.

- [ ] **Step 3: Commit**

```bash
git add agent-sidecar/src/tools.ts
git commit -m "feat: add VIBE OS MCP tools for graph provenance, impact, decisions"
```

---

## Task 5: Rust Sidecar Process Manager

**Files:**
- Create: `src-tauri/src/services/sidecar.rs`
- Modify: `src-tauri/src/services/mod.rs`

- [ ] **Step 1: Create sidecar.rs**

Create `src-tauri/src/services/sidecar.rs`:

```rust
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex as TokioMutex;

/// Managed state for the sidecar process.
pub type SidecarState = Arc<TokioMutex<Option<SidecarProcess>>>;

pub struct SidecarProcess {
    pub child: Child,
    pub ready: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum SidecarCommand {
    #[serde(rename = "start")]
    Start {
        #[serde(rename = "sessionId")]
        session_id: String,
        prompt: String,
        #[serde(rename = "systemPrompt")]
        system_prompt: String,
        options: serde_json::Value,
    },
    #[serde(rename = "send")]
    Send {
        #[serde(rename = "sessionId")]
        session_id: String,
        prompt: String,
    },
    #[serde(rename = "cancel")]
    Cancel {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    #[serde(rename = "tool_response")]
    ToolResponse {
        #[serde(rename = "requestId")]
        request_id: String,
        result: serde_json::Value,
    },
    #[serde(rename = "stop")]
    Stop,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum SidecarEvent {
    #[serde(rename = "ready")]
    Ready,
    #[serde(rename = "sdk_message")]
    SdkMessage {
        #[serde(rename = "sessionId")]
        session_id: String,
        message: serde_json::Value,
    },
    #[serde(rename = "tool_request")]
    ToolRequest {
        #[serde(rename = "requestId")]
        request_id: String,
        tool: String,
        input: serde_json::Value,
    },
    #[serde(rename = "session_ended")]
    SessionEnded {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    #[serde(rename = "error")]
    Error {
        #[serde(rename = "sessionId")]
        session_id: Option<String>,
        error: String,
    },
}

/// Spawn the Node sidecar process.
pub fn spawn_sidecar() -> Result<Child, String> {
    // Look for the sidecar in the expected location
    let sidecar_path = find_sidecar_path()?;

    let child = Command::new("node")
        .arg(&sidecar_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    Ok(child)
}

fn find_sidecar_path() -> Result<String, String> {
    // In dev: look relative to project root
    let dev_path = std::env::current_dir()
        .map(|p| p.join("agent-sidecar").join("dist").join("main.mjs"))
        .ok();

    if let Some(ref p) = dev_path {
        if p.exists() {
            return Ok(p.to_string_lossy().to_string());
        }
    }

    // In production: look relative to executable
    let exe_dir = std::env::current_exe()
        .map(|p| p.parent().unwrap_or(p.as_path()).to_path_buf())
        .map_err(|e| e.to_string())?;

    let prod_path = exe_dir.join("agent-sidecar").join("main.mjs");
    if prod_path.exists() {
        return Ok(prod_path.to_string_lossy().to_string());
    }

    Err("Agent sidecar not found. Run 'npm run build' in agent-sidecar/".to_string())
}

/// Send a command to the sidecar via stdin.
pub fn send_to_sidecar(child: &mut Child, cmd: &SidecarCommand) -> Result<(), String> {
    let stdin = child.stdin.as_mut().ok_or("Sidecar stdin not available")?;
    let json = serde_json::to_string(cmd).map_err(|e| e.to_string())?;
    writeln!(stdin, "{}", json).map_err(|e| format!("Failed to write to sidecar: {}", e))?;
    stdin.flush().map_err(|e| format!("Failed to flush sidecar stdin: {}", e))?;
    Ok(())
}

/// Read events from sidecar stdout in a blocking loop.
/// Call this from a background thread.
pub fn read_sidecar_stdout(child: &mut Child) -> Option<BufReader<std::process::ChildStdout>> {
    child.stdout.take().map(BufReader::new)
}
```

- [ ] **Step 2: Register module**

In `src-tauri/src/services/mod.rs`, add:

```rust
pub mod sidecar;
pub mod tool_handler;
```

If `mod.rs` doesn't exist, create it with:

```rust
pub mod event_stream;
pub mod sidecar;
pub mod tool_handler;
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/services/sidecar.rs src-tauri/src/services/mod.rs
git commit -m "feat: add Rust sidecar process manager"
```

---

## Task 6: Rust Tool Handler

**Files:**
- Create: `src-tauri/src/services/tool_handler.rs`

- [ ] **Step 1: Create tool_handler.rs**

Create `src-tauri/src/services/tool_handler.rs`:

```rust
use serde_json::json;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

use crate::graph::queries;

/// Handle a tool request from the sidecar and return a JSON result.
pub async fn handle_tool_request(
    graph_db: &Surreal<Db>,
    tool: &str,
    input: &serde_json::Value,
    session_id: &str,
) -> Result<serde_json::Value, String> {
    match tool {
        "vibe_graph_provenance" => {
            let function_id = input["functionId"]
                .as_str()
                .ok_or("Missing functionId")?;
            let trace = queries::get_provenance(graph_db, function_id).await
                .map_err(|e| e.to_string())?;
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&trace).unwrap_or_default()
                }]
            }))
        }

        "vibe_graph_impact" => {
            let function_id = input["functionId"]
                .as_str()
                .ok_or("Missing functionId")?;
            let impact = queries::get_impact(graph_db, function_id).await
                .map_err(|e| e.to_string())?;
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&impact).unwrap_or_default()
                }]
            }))
        }

        "vibe_record_decision" => {
            let decision = input["decision"].as_str().unwrap_or("");
            let rationale = input["rationale"].as_str().unwrap_or("");
            let confidence = input["confidence"].as_f64().unwrap_or(0.5);
            let impact_category = input["impactCategory"].as_str().unwrap_or("dx");
            let reversible = input["reversible"].as_bool().unwrap_or(true);
            let related_files: Vec<String> = input["relatedFiles"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let related_tickets: Vec<String> = input["relatedTickets"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            crate::graph::population::populate_decision(
                graph_db,
                session_id,
                decision,
                rationale,
                confidence,
                impact_category,
                reversible,
                &related_files,
                &related_tickets,
            )
            .await
            .map_err(|e| e.to_string())?;

            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": format!("Decision recorded: {}", decision)
                }]
            }))
        }

        "vibe_search_graph" => {
            let query_str = input["query"].as_str().ok_or("Missing query")?;
            let results = queries::search(graph_db, query_str).await
                .map_err(|e| e.to_string())?;
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&results).unwrap_or_default()
                }]
            }))
        }

        "vibe_session_context" => {
            let sid = input["sessionId"].as_str().unwrap_or(session_id);
            let report = queries::get_session_report(graph_db, sid).await
                .map_err(|e| e.to_string())?;
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&report).unwrap_or_default()
                }]
            }))
        }

        "vibe_architecture" => {
            let entry_point = input["entryPoint"].as_str().ok_or("Missing entryPoint")?;
            let topology = queries::get_topology(graph_db).await
                .map_err(|e| e.to_string())?;
            // Filter topology to neighborhood of entry_point
            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": serde_json::to_string_pretty(&topology).unwrap_or_default()
                }]
            }))
        }

        _ => Err(format!("Unknown tool: {}", tool)),
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/services/tool_handler.rs
git commit -m "feat: add tool handler for sidecar MCP tool requests"
```

---

## Task 7: New Agent Commands (Rust)

**Files:**
- Create: `src-tauri/src/commands/agent_commands_v2.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create agent_commands_v2.rs**

Create `src-tauri/src/commands/agent_commands_v2.rs`:

```rust
use std::io::BufRead;

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

use crate::services::sidecar::{
    self, SidecarCommand, SidecarEvent, SidecarState,
};
use crate::services::tool_handler;
use crate::graph;

/// Start the sidecar process if not already running.
#[tauri::command]
pub async fn ensure_sidecar(app: AppHandle) -> Result<String, String> {
    let state = app.state::<SidecarState>();
    let mut guard = state.lock().await;

    if guard.as_ref().map(|s| s.ready).unwrap_or(false) {
        return Ok("already_running".to_string());
    }

    let mut child = sidecar::spawn_sidecar()?;

    // Read the first line — should be {"type":"ready"}
    let stdout = sidecar::read_sidecar_stdout(&mut child)
        .ok_or("Failed to get sidecar stdout")?;

    // Store the process (without stdout — we'll take it for the reader thread)
    *guard = Some(sidecar::SidecarProcess { child, ready: false });
    drop(guard);

    // Spawn background reader thread
    let app_handle = app.clone();
    let sidecar_state = app.state::<SidecarState>().inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        for line in stdout.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };

            if line.trim().is_empty() {
                continue;
            }

            let event: SidecarEvent = match serde_json::from_str(&line) {
                Ok(e) => e,
                Err(err) => {
                    eprintln!("[sidecar] Parse error: {} for line: {}", err, line);
                    continue;
                }
            };

            match &event {
                SidecarEvent::Ready => {
                    // Mark sidecar as ready
                    if let Ok(mut guard) = tauri::async_runtime::block_on(sidecar_state.lock()).as_deref_mut() {
                        // Can't easily set ready here due to borrow — emit event instead
                    }
                    let _ = app_handle.emit("agent-event", json!({
                        "type": "sidecar_ready"
                    }));
                }

                SidecarEvent::SdkMessage { session_id, message } => {
                    let _ = app_handle.emit("agent-event", json!({
                        "type": "sdk_message",
                        "sessionId": session_id,
                        "message": message,
                    }));
                }

                SidecarEvent::ToolRequest { request_id, tool, input } => {
                    // Handle tool request asynchronously
                    let app2 = app_handle.clone();
                    let state2 = sidecar_state.clone();
                    let rid = request_id.clone();
                    let tool_name = tool.clone();
                    let tool_input = input.clone();

                    tauri::async_runtime::spawn(async move {
                        let graph_db = app2.state::<surrealdb::Surreal<surrealdb::engine::local::Db>>();
                        let result = tool_handler::handle_tool_request(
                            &graph_db,
                            &tool_name,
                            &tool_input,
                            "", // session_id — extracted from context
                        )
                        .await;

                        let response = SidecarCommand::ToolResponse {
                            request_id: rid,
                            result: result.unwrap_or_else(|e| json!({
                                "content": [{"type": "text", "text": format!("Error: {}", e)}]
                            })),
                        };

                        let mut guard = state2.lock().await;
                        if let Some(ref mut proc) = *guard {
                            let _ = sidecar::send_to_sidecar(&mut proc.child, &response);
                        }
                    });
                }

                SidecarEvent::SessionEnded { session_id } => {
                    let _ = app_handle.emit("agent-event", json!({
                        "type": "session_ended",
                        "sessionId": session_id,
                    }));
                }

                SidecarEvent::Error { session_id, error } => {
                    let _ = app_handle.emit("agent-event", json!({
                        "type": "error",
                        "sessionId": session_id,
                        "error": error,
                    }));
                }
            }
        }
    });

    Ok("started".to_string())
}

/// Start an agent session.
#[tauri::command]
pub async fn start_agent(
    app: AppHandle,
    session_id: String,
    prompt: String,
    workspace_path: String,
) -> Result<(), String> {
    // Ensure sidecar is running
    ensure_sidecar(app.clone()).await?;

    // Assemble graph context
    let graph_db = app.state::<surrealdb::Surreal<surrealdb::engine::local::Db>>();
    let graph_context = assemble_graph_context(&graph_db, &prompt, &session_id).await;

    // Build the start command
    let cmd = SidecarCommand::Start {
        session_id: session_id.clone(),
        prompt,
        system_prompt: graph_context,
        options: json!({
            "cwd": workspace_path,
            "model": "sonnet",
            "permissionMode": "acceptEdits",
            "tools": { "type": "preset", "preset": "claude_code" },
            "maxTurns": 50,
            "settingSources": ["project"],
            "effort": "high",
        }),
    };

    let state = app.state::<SidecarState>();
    let mut guard = state.lock().await;
    if let Some(ref mut proc) = *guard {
        sidecar::send_to_sidecar(&mut proc.child, &cmd)?;
    } else {
        return Err("Sidecar not running".to_string());
    }

    Ok(())
}

/// Send a follow-up message to an existing session.
#[tauri::command]
pub async fn send_agent_message(
    app: AppHandle,
    session_id: String,
    prompt: String,
) -> Result<(), String> {
    let cmd = SidecarCommand::Send {
        session_id,
        prompt,
    };

    let state = app.state::<SidecarState>();
    let mut guard = state.lock().await;
    if let Some(ref mut proc) = *guard {
        sidecar::send_to_sidecar(&mut proc.child, &cmd)?;
    } else {
        return Err("Sidecar not running".to_string());
    }

    Ok(())
}

/// Cancel an active agent session.
#[tauri::command]
pub async fn cancel_agent(
    app: AppHandle,
    session_id: String,
) -> Result<(), String> {
    let cmd = SidecarCommand::Cancel { session_id };

    let state = app.state::<SidecarState>();
    let mut guard = state.lock().await;
    if let Some(ref mut proc) = *guard {
        sidecar::send_to_sidecar(&mut proc.child, &cmd)?;
    } else {
        return Err("Sidecar not running".to_string());
    }

    Ok(())
}

/// Get sidecar status.
#[tauri::command]
pub async fn get_sidecar_status(app: AppHandle) -> Result<String, String> {
    let state = app.state::<SidecarState>();
    let guard = state.lock().await;
    match &*guard {
        Some(proc) if proc.ready => Ok("ready".to_string()),
        Some(_) => Ok("starting".to_string()),
        None => Ok("stopped".to_string()),
    }
}

/// Assemble graph context from SurrealDB for the system prompt.
async fn assemble_graph_context(
    graph_db: &surrealdb::Surreal<surrealdb::engine::local::Db>,
    user_message: &str,
    session_id: &str,
) -> String {
    let mut context_parts: Vec<String> = Vec::new();

    // Extract file/function references from the user message
    let file_refs = extract_references(user_message);

    // Query provenance for each reference
    for ref_id in &file_refs {
        if let Ok(trace) = graph::queries::get_provenance(graph_db, ref_id).await {
            if !trace.decisions.is_empty() || !trace.tests.is_empty() {
                context_parts.push(format!(
                    "## Provenance: {}\n{}",
                    ref_id,
                    format_provenance(&trace)
                ));
            }
        }
    }

    // Query session history
    if let Ok(report) = graph::queries::get_session_report(graph_db, session_id).await {
        if !report.decisions.is_empty() || !report.timeline.is_empty() {
            context_parts.push(format!(
                "## Session History\n- {} actions, {} decisions, {} tokens used",
                report.timeline.len(),
                report.decisions.len(),
                report.total_tokens,
            ));
        }
    }

    if context_parts.is_empty() {
        String::new()
    } else {
        format!("\n\n# VIBE OS Context\n\n{}", context_parts.join("\n\n"))
    }
}

fn extract_references(message: &str) -> Vec<String> {
    let mut refs = Vec::new();

    // Match file paths like src/foo/bar.ts, components/MyComponent.tsx
    let path_re = regex::Regex::new(r"(?:^|[\s`(])([a-zA-Z][\w/.-]*\.\w{1,5})(?:[\s`),:]|$)").unwrap();
    for cap in path_re.captures_iter(message) {
        if let Some(m) = cap.get(1) {
            refs.push(m.as_str().to_string());
        }
    }

    refs
}

fn format_provenance(trace: &graph::queries::ProvenanceTrace) -> String {
    let mut out = String::new();

    if !trace.decisions.is_empty() {
        out.push_str("### Recent decisions\n");
        for d in &trace.decisions {
            let summary = d["summary"].as_str().unwrap_or("(no summary)");
            let confidence = d["confidence"].as_f64().unwrap_or(0.0);
            out.push_str(&format!("- {} (confidence: {:.1})\n", summary, confidence));
        }
    }

    if !trace.tests.is_empty() {
        out.push_str("### Test coverage\n");
        for t in &trace.tests {
            let name = t["name"].as_str().unwrap_or("(unknown test)");
            let status = t["status"].as_str().unwrap_or("unknown");
            out.push_str(&format!("- {}: {}\n", name, status));
        }
    }

    out
}
```

- [ ] **Step 2: Register in mod.rs**

In `src-tauri/src/commands/mod.rs`, add:

```rust
pub mod agent_commands_v2;
```

- [ ] **Step 3: Register commands in lib.rs**

In `src-tauri/src/lib.rs`, add import:

```rust
use commands::agent_commands_v2;
```

Add sidecar state initialization inside the `setup()` closure (after the workspace watcher state):

```rust
            // Register sidecar state
            app.manage(services::sidecar::SidecarState::default());
```

Note: `SidecarState` is `Arc<TokioMutex<Option<SidecarProcess>>>` which needs `Default`. Add a `default()` constructor or use `Arc::new(TokioMutex::new(None))` directly.

Add to the `invoke_handler` macro:

```rust
            agent_commands_v2::ensure_sidecar,
            agent_commands_v2::start_agent,
            agent_commands_v2::send_agent_message,
            agent_commands_v2::cancel_agent,
            agent_commands_v2::get_sidecar_status,
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/agent_commands_v2.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add agent_commands_v2 with sidecar management and graph context assembly"
```

---

## Task 8: Frontend Agent Stream Hook

**Files:**
- Create: `src/hooks/useAgentStream.ts`
- Create: `src/lib/agentCommands.ts`

- [ ] **Step 1: Create agentCommands.ts**

Create `src/lib/agentCommands.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";

export const agentCommands = {
  ensureSidecar: () => invoke<string>("ensure_sidecar"),

  startAgent: (sessionId: string, prompt: string, workspacePath: string) =>
    invoke<void>("start_agent", { sessionId, prompt, workspacePath }),

  sendAgentMessage: (sessionId: string, prompt: string) =>
    invoke<void>("send_agent_message", { sessionId, prompt }),

  cancelAgent: (sessionId: string) =>
    invoke<void>("cancel_agent", { sessionId }),

  getSidecarStatus: () =>
    invoke<"ready" | "starting" | "stopped">("get_sidecar_status"),
};
```

- [ ] **Step 2: Create useAgentStream.ts**

Create `src/hooks/useAgentStream.ts`:

```typescript
import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "../stores";

interface SdkAssistantMessage {
  type: "assistant";
  uuid: string;
  session_id: string;
  message: {
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      | { type: "thinking"; thinking: string }
    >;
    model: string;
    stop_reason: string | null;
    usage: { input_tokens: number; output_tokens: number };
  };
}

interface SdkResultMessage {
  type: "result";
  subtype: "success" | "error";
  session_id: string;
  duration_ms: number;
  total_cost_usd: number;
  num_turns: number;
  usage: { input_tokens: number; output_tokens: number };
  result: string;
}

interface AgentEventPayload {
  type: "sdk_message" | "sidecar_ready" | "session_ended" | "error";
  sessionId?: string;
  message?: SdkAssistantMessage | SdkResultMessage | Record<string, unknown>;
  error?: string;
}

/**
 * Hook that listens to 'agent-event' Tauri events from the sidecar
 * and dispatches typed SDK messages to the Zustand store.
 *
 * Mount once at the app level.
 */
export function useAgentStream() {
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    const setup = async () => {
      unlistenRef.current = await listen<AgentEventPayload>("agent-event", (event) => {
        const data = event.payload;
        const store = useAppStore.getState();

        if (data.type === "sidecar_ready") {
          // Sidecar is ready — could update UI status
          return;
        }

        const sid = data.sessionId;
        if (!sid) return;

        // Ensure session exists in store
        if (!store.claudeSessions.has(sid)) {
          store.createClaudeSessionLocal(sid, "Agent Session");
        }

        if (data.type === "sdk_message" && data.message) {
          const msg = data.message;

          if (msg.type === "assistant") {
            const assistantMsg = msg as SdkAssistantMessage;
            // Extract text content
            const textParts = assistantMsg.message.content
              .filter((c): c is { type: "text"; text: string } => c.type === "text")
              .map((c) => c.text);

            if (textParts.length > 0) {
              store.addSessionChatMessage(sid, {
                id: assistantMsg.uuid || crypto.randomUUID(),
                role: "assistant",
                content: textParts.join("\n"),
                timestamp: new Date().toISOString(),
              });
            }

            // Extract tool uses for activity cards
            const toolUses = assistantMsg.message.content
              .filter((c): c is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => c.type === "tool_use");

            for (const tu of toolUses) {
              store.addSessionAgentEvent(sid, {
                timestamp: new Date().toISOString(),
                event_type: "raw",
                content: `Tool: ${tu.name}`,
                metadata: { tool: tu.name, input: tu.input, tool_use_id: tu.id },
              });
            }

            store.setSessionWorking(sid, true);
          }

          if (msg.type === "result") {
            const resultMsg = msg as SdkResultMessage;
            store.setSessionWorking(sid, false);

            store.insertRichCard(sid, "outcome", resultMsg.result || "Done", {
              cost_usd: resultMsg.total_cost_usd,
              duration_ms: resultMsg.duration_ms,
              num_turns: resultMsg.num_turns,
              input_tokens: resultMsg.usage?.input_tokens,
              output_tokens: resultMsg.usage?.output_tokens,
            });
          }
        }

        if (data.type === "session_ended") {
          store.setSessionWorking(sid, false);
        }

        if (data.type === "error") {
          store.setSessionError(sid, data.error || "Unknown error");
          store.setSessionWorking(sid, false);
        }
      });
    };

    setup();

    return () => {
      unlistenRef.current?.();
    };
  }, []);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/agentCommands.ts src/hooks/useAgentStream.ts
git commit -m "feat: add useAgentStream hook and agentCommands for SDK integration"
```

---

## Task 9: Wire Frontend to New Agent Commands

**Files:**
- Modify: `src/components/panels/ClaudeChat.tsx`
- Modify: `src/App.tsx` (or wherever useClaudeStream is mounted)

- [ ] **Step 1: Find where useClaudeStream is mounted**

Search for `useClaudeStream` usage — it's likely in `App.tsx` or `ClaudeChat.tsx`. The new `useAgentStream` hook needs to be mounted in the same place.

- [ ] **Step 2: Add useAgentStream alongside useClaudeStream**

During the migration period, mount BOTH hooks so the old CLI path still works. In the file that calls `useClaudeStream()`, add:

```typescript
import { useAgentStream } from "./hooks/useAgentStream";

// Inside the component:
useClaudeStream(); // existing — keep for CLI fallback
useAgentStream();  // new — for SDK sidecar
```

- [ ] **Step 3: Add SDK path to ClaudeChat**

In `src/components/panels/ClaudeChat.tsx`, add the import and a toggle for which backend to use. In the `handleSend` function, add an SDK path:

```typescript
import { agentCommands } from "../../lib/agentCommands";
```

In `handleSend`, before the existing `commands.startClaude()` call, add the SDK path:

```typescript
    // Use SDK sidecar if available
    const sidecarStatus = await agentCommands.getSidecarStatus().catch(() => "stopped");
    if (sidecarStatus === "ready" || sidecarStatus === "starting") {
      const workspace = useAppStore.getState().activeWorkspace;
      if (session.conversationId) {
        await agentCommands.sendAgentMessage(session.id, message);
      } else {
        await agentCommands.startAgent(session.id, message, workspace?.path ?? process.cwd());
      }
      return;
    }

    // Fall back to CLI
```

Similarly update `handleCancel`:

```typescript
    const sidecarStatus = await agentCommands.getSidecarStatus().catch(() => "stopped");
    if (sidecarStatus === "ready") {
      await agentCommands.cancelAgent(activeClaudeSessionId);
      return;
    }
    // Fall back to CLI cancel
```

- [ ] **Step 4: Auto-start sidecar on app load**

In the same component or `App.tsx`, add sidecar initialization:

```typescript
useEffect(() => {
  agentCommands.ensureSidecar().catch(console.warn);
}, []);
```

- [ ] **Step 5: Run tests**

```bash
npm run test
```

Expected: 98 tests pass (no tests depend on the Claude CLI integration directly).

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/ClaudeChat.tsx src/App.tsx
git commit -m "feat: wire frontend to SDK sidecar with CLI fallback"
```

---

## Task 10: Tauri Configuration + Build Pipeline

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `package.json`

- [ ] **Step 1: Add sidecar to Tauri bundle config**

In `src-tauri/tauri.conf.json`, add the `externalBin` field inside `bundle`:

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "externalBin": [],
    "icon": [...],
    "resources": {
      "skills/*.md": "skills/",
      "../agent-sidecar/dist/*": "agent-sidecar/"
    }
  }
}
```

Note: We bundle the sidecar as a resource (not externalBin) since it's a Node script, not a native binary. The Rust code uses `node` to run it.

- [ ] **Step 2: Add build scripts to package.json**

In `package.json`, update scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "build:sidecar": "cd agent-sidecar && npm install && npm run build",
    "prebuild": "npm run build:sidecar",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:rust": "cd src-tauri && cargo test --lib",
    "test:all": "vitest run && cd src-tauri && cargo test --lib",
    "tauri": "tauri"
  }
}
```

The `prebuild` hook ensures the sidecar is built before the main app build.

- [ ] **Step 3: Build and verify the full pipeline**

```bash
npm run build:sidecar && npm run build
```

Expected: sidecar builds to `agent-sidecar/dist/main.mjs`, frontend builds successfully.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/tauri.conf.json package.json
git commit -m "feat: add sidecar build pipeline and Tauri resource bundling"
```

---

## Task 11: Integration Test

**Files:**
- Various — testing and verifying the full flow

- [ ] **Step 1: Build everything**

```bash
npm run build:sidecar && npm run test
```

Verify 98 tests pass and sidecar builds.

- [ ] **Step 2: Manual smoke test**

Run `npm run tauri dev` and verify:
1. App launches without errors
2. Sidecar starts (check console for "sidecar_ready" event)
3. Create a project, send a message
4. If Claude Code subscription is available: messages flow through SDK, events appear in chat
5. If not: falls back to CLI path gracefully

- [ ] **Step 3: Verify graph context injection**

With the app running, check that:
1. Sending a message that references a file path triggers graph context assembly
2. The system prompt sent to the sidecar includes `# VIBE OS Context` section
3. Graph tool requests from Claude are handled (check Rust console logs)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for SDK sidecar pipeline"
```
