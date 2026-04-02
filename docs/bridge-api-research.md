# Claude Code Bridge Protocol Research

> Research document for VIBE OS — Task 6a of RALPH-PLAN.md
> Status: Research only — do NOT implement bridge integration yet

## Overview

This document examines how Claude Code communicates with external tools (IDE extensions, SDKs, web clients) and evaluates whether VIBE OS should migrate from stdout parsing to a bridge protocol.

---

## 1. How to Start a Bridge Session

Claude Code supports multiple session modes, each with different transport mechanisms:

### Subprocess + NDJSON (Current VIBE OS Approach)

```bash
# What VIBE OS currently does:
claude -p --output-format stream-json --verbose

# Enhanced bidirectional variant:
claude -p --output-format stream-json --input-format stream-json --verbose
```

- Spawns Claude CLI as a child process
- Reads NDJSON from stdout, writes NDJSON to stdin
- This is what the Python/TypeScript Agent SDKs use internally

### WebSocket Bridge via `--sdk-url`

```bash
claude -p --sdk-url ws://localhost:PORT --output-format stream-json --input-format stream-json
```

- **Hidden flag** (not in `--help`): `--sdk-url <url>` transforms the CLI into a WebSocket client
- The terminal UI disappears; all I/O flows over the WebSocket
- This is how `claude.ai` runs Claude Code sessions in cloud environments (Teleport feature)
- Requires a WebSocket server (bridge server) to be running at the specified URL

### Permission Control Mode

```bash
claude -p --output-format stream-json --permission-prompt-tool stdio
```

- Enables `control_request`/`control_response` exchanges over stdin/stdout
- Gives the host application full control over tool approval decisions
- Alternative: `--permission-prompt-tool mcp_server_name__tool_name` delegates to an MCP tool

### IDE Integration (MCP Server)

The VS Code extension and JetBrains plugin run a **local MCP server** named `ide`:

- **Transport:** HTTP on `127.0.0.1` (random high port, localhost only)
- **Auth:** Random token per activation, written to `~/.claude/ide/` lock file (0600 perms in 0700 dir)
- **Discovery:** CLI auto-discovers via lock file when run in IDE's integrated terminal
- **Tools exposed to model:** Only 2 — `mcp__ide__getDiagnostics` (Problems panel) and `mcp__ide__executeCode` (Jupyter)
- **Internal RPC tools:** ~12 total (open diffs, read selections, save files) — filtered from model's view

---

## 2. Messages Between Bridge Client and Server

### Top-Level Message Types (CLI stdout)

| Type | Description |
|------|-------------|
| `system` | Init payload, status updates, API retry events |
| `assistant` | Claude's response messages (text + tool use blocks) |
| `user` | User message echoes (with `--replay-user-messages`) |
| `result` | Turn completion with cost, usage, error status |
| `stream_event` | Raw API streaming events (with `--include-partial-messages`) |
| `control_request` | Permission/hook callback requests from CLI |

### Input Message Format (stdin to CLI)

User message envelope:
```json
{
  "type": "user",
  "message": { "role": "user", "content": "your prompt here" },
  "parent_tool_use_id": null,
  "session_id": "uuid-here"
}
```

### System Init Payload (first message from CLI)

```json
{
  "type": "system",
  "subtype": "init",
  "session_id": "...",
  "tools": [...],
  "mcp_servers": [...],
  "model": "...",
  "permissionMode": "...",
  "apiKeySource": "...",
  "claude_code_version": "...",
  "slash_commands": [...]
}
```

### Control Request/Response Protocol

**Control Request (CLI --> host, via stdout):**
```json
{
  "type": "control_request",
  "request_id": "req_1_abc123",
  "request": {
    "subtype": "can_use_tool",
    "tool_name": "Bash",
    "input": {"command": "ls /home"},
    "description": "...",
    "tool_use_id": "..."
  }
}
```

**Control Response — Allow (host --> CLI, via stdin):**
```json
{
  "type": "control_response",
  "request_id": "req_1_abc123",
  "response": {
    "subtype": "success",
    "response": {
      "behavior": "allow",
      "updatedInput": {"command": "ls /home"}
    }
  }
}
```

**Control Response — Deny:**
```json
{
  "type": "control_response",
  "request_id": "req_1_abc123",
  "response": {
    "subtype": "success",
    "response": {
      "behavior": "deny",
      "message": "Operation not permitted"
    }
  }
}
```

Multiple control requests can be in-flight simultaneously, matched by `request_id`.

### Stream Event Types (within `stream_event` messages)

| Event Type | Description |
|------------|-------------|
| `message_start` | Start of a new message |
| `content_block_start` | Start of text or tool_use block |
| `content_block_delta` | Incremental text (`text_delta`) or tool input (`input_json_delta`) |
| `content_block_stop` | End of a content block |
| `message_delta` | Message-level updates (stop reason, usage) |
| `message_stop` | End of the message |

### WebSocket Bridge Messages (browser <--> CLI)

Additional message types in the WebSocket bridge layer:

**Browser --> CLI:**
- `user_message` (with optional images)
- `permission_response` (allow/deny with `request_id`)
- `set_model`, `set_permission_mode`, `interrupt`

**CLI --> Browser:**
- `system` (init/status)
- `assistant` (AI responses)
- `result` (turn completion with `total_cost_usd`, `num_turns`, `modelUsage`)
- `stream_event` (real-time deltas)
- `control_request` / `permission_request` (tool approval)

---

## 3. Advantages Over Stdout Parsing

### Current Approach: Subprocess stdout parsing

**Strengths:**
- Works with publicly documented CLI flags (`-p`, `--output-format stream-json`)
- Reliable line-by-line processing with `BufReader`
- Well-tested — `event_stream.rs` has 22 tests against real captured CLI output
- Cross-platform compatible (Windows, macOS, Linux)
- No external server needed

**Weaknesses:**
- One-directional control — VIBE OS can read events but has limited ability to send commands back
- No permission interception — can't approve/deny tool use
- Must parse all tool use from assistant message content blocks
- Session resume requires restarting the subprocess
- No real-time model/mode switching

### Bridge Protocol (WebSocket or bidirectional NDJSON)

**Strengths:**
- **Full bidirectional control** — send messages, interrupt, change model/mode mid-session
- **Permission delegation** — VIBE OS could intercept and approve/deny every tool use
- **Richer init payload** — `system.init` provides tools list, MCP servers, slash commands, model info
- **Session persistence** — WebSocket bridge supports reconnection without losing context
- **Lower latency** — direct IPC vs buffered stdout parsing
- **Structured errors** — typed error messages vs stderr string parsing
- **Multiple concurrent control requests** — parallel permission flows via `request_id`

**Weaknesses:**
- `--sdk-url` is a hidden/undocumented flag — may change without notice
- WebSocket bridge requires running a bridge server
- More complex implementation (connection management, reconnection, heartbeats)
- Less community documentation and examples

---

## 4. Migration Path

### Phase 1: Bidirectional NDJSON (Low Risk)

Add `--input-format stream-json` to the existing subprocess spawn. This enables:

1. **Sending user messages via stdin** instead of only at launch via `-p`
2. **Multi-turn conversations** within a single subprocess
3. **Interrupt support** by writing interrupt messages to stdin

Implementation in `claude_commands.rs`:
- Change spawn args to include `--input-format stream-json`
- Store stdin handle alongside the `Child` process
- Add a new command `send_to_claude(session_id, message)` that writes to stdin

### Phase 2: Permission Control (Medium Risk)

Add `--permission-prompt-tool stdio` to enable the control request/response protocol:

1. Parse `control_request` messages from stdout alongside regular events
2. Emit them as Tauri events to the frontend
3. Add UI for approving/denying tool use
4. Write `control_response` messages back to stdin

This gives VIBE OS **full permission management** — a significant UX improvement.

### Phase 3: WebSocket Bridge (Higher Risk, Higher Reward)

Replace subprocess with WebSocket connection:

1. Start a local WebSocket bridge server in the Tauri backend
2. Spawn Claude CLI with `--sdk-url ws://localhost:PORT`
3. All communication flows over WebSocket
4. Enables reconnection, remote sessions, and Teleport-like features

This is the architecture that `claude.ai` uses and that [The Vibe Company's companion](https://github.com/The-Vibe-Company/companion) has implemented as open source.

### Recommended Approach

**Start with Phase 1** — it's backward-compatible and low-risk. The existing `event_stream.rs` parser continues to work; we just add stdin writing capability. This unlocks multi-turn sessions and interrupts with minimal code changes.

**Phase 2** is the biggest UX win — permission interception lets VIBE OS be a true cockpit rather than a passive observer.

**Phase 3** should wait until `--sdk-url` is officially documented or until we need remote session support.

---

## 5. Transport Architecture Summary

| Integration | Transport | Auth | Direction |
|------------|-----------|------|-----------|
| VS Code / JetBrains MCP | HTTP localhost (random port) | Random token in `~/.claude/ide/` | Bidirectional |
| Agent SDK (Python/TS) | stdin/stdout subprocess | Process isolation | Bidirectional NDJSON |
| Remote/Teleport sessions | WebSocket via `--sdk-url` | JWT / Claude.ai OAuth | Bidirectional |
| CLI headless (`-p`) | stdin/stdout | N/A | NDJSON out, text in |
| VIBE OS (current) | Subprocess stdout | Process isolation | Read-only NDJSON |

Three internal session manager types:
- **RemoteSessionManager** — Bridge Proxy (WS/HTTP), Claude.ai OAuth, for cloud environments
- **DirectConnectManager** — Direct WebSocket, config-based auth, for local/private networks
- **SSHSessionManager** — SSH child process, SSH keys, for remote servers

---

## 6. References

- [Claude Code headless mode docs](https://code.claude.com/docs/en/headless) — `-p`, `--output-format`, streaming
- [VS Code extension docs](https://code.claude.com/docs/en/vs-code) — IDE MCP server architecture
- [Agent SDK streaming output](https://platform.claude.com/docs/en/agent-sdk/streaming-output) — StreamEvent reference
- [Agent SDK permissions](https://platform.claude.com/docs/en/agent-sdk/permissions) — permission modes and evaluation flow
- [GitHub Issue #24594](https://github.com/anthropics/claude-code/issues/24594) — `--input-format stream-json` is undocumented
- [GitHub Issue #24596](https://github.com/anthropics/claude-code/issues/24596) — `--output-format stream-json` event types lack reference
- [Inside the Claude Agent SDK: stdin/stdout Communication](https://buildwithaws.substack.com/p/inside-the-claude-agent-sdk-from) — Subprocess NDJSON protocol deep dive
- [The Vibe Companion ws-bridge.ts](https://github.com/The-Vibe-Company/companion) — Open-source WebSocket bridge server implementation
