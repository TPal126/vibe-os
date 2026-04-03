# Native Agent Loop — Ralph Plan

Replace the Claude Code CLI wrapper with a native agent loop using the Claude Agent SDK, running as a Tauri Node sidecar with graph-native context injection and custom MCP tools.

## How This Plan Works

You are an autonomous agent running in a loop. Each time you start:

1. Read this file to find the next unchecked task (marked `- [ ]`)
2. Read the detailed implementation plan at `docs/superpowers/plans/2026-04-02-native-agent-loop.md` for exact code
3. Implement ONLY that one task following the plan exactly
4. Run `npm run test` to verify no regressions (98 tests should pass)
5. Mark the task as done by changing `- [ ]` to `- [x]` in this file
6. Commit all changes (including the updated RALPH-PLAN.md) with a descriptive message
7. If ALL tasks are now checked, output RALPH_DONE
8. Exit — do not proceed to the next task

## Rules

- Work from the repo root
- Read existing code before modifying it
- Follow patterns in CLAUDE.md
- The detailed plan has exact code for each task — use it
- Do NOT skip steps or combine tasks

---

## Tasks

- [x] **Task 1: Scaffold the Node Sidecar Project** — Create `agent-sidecar/` with package.json, tsconfig.json, src/types.ts, build.mjs. Install deps and verify build.

- [x] **Task 2: Implement Sidecar Main Entry Point** — Create `agent-sidecar/src/main.ts` with stdin/stdout JSON line protocol dispatcher. Create session.ts stub.

- [x] **Task 3: Implement Session Manager** — Replace session.ts stub with full SessionManager using SDK `query()`, multi-turn via `streamInput()`, cancel via `query.close()`.

- [x] **Task 4: Implement MCP Tools** — Create `agent-sidecar/src/tools.ts` with 6 VIBE OS tools: vibe_graph_provenance, vibe_graph_impact, vibe_record_decision, vibe_search_graph, vibe_session_context, vibe_architecture. Uses request/response callback to Rust.

- [x] **Task 5: Rust Sidecar Process Manager** — Create `src-tauri/src/services/sidecar.rs` with spawn_sidecar(), send_to_sidecar(), read_sidecar_stdout(). Register in services/mod.rs.

- [x] **Task 6: Rust Tool Handler** — Create `src-tauri/src/services/tool_handler.rs` with handle_tool_request() dispatching to graph queries (provenance, impact, search, session report, topology, populate_decision).

- [x] **Task 7: New Agent Commands (Rust)** — Create `src-tauri/src/commands/agent_commands_v2.rs` with ensure_sidecar, start_agent (with graph context assembly), send_agent_message, cancel_agent, get_sidecar_status. Register in mod.rs and lib.rs.

- [x] **Task 8: Frontend Agent Stream Hook** — Create `src/hooks/useAgentStream.ts` listening to "agent-event" Tauri events, mapping typed SDKMessage to store updates. Create `src/lib/agentCommands.ts` with typed wrappers.

- [x] **Task 9: Wire Frontend to New Agent Commands** — Mount useAgentStream alongside useClaudeStream. Update ClaudeChat.tsx handleSend/handleCancel to use SDK path with CLI fallback. Auto-start sidecar on app load.

- [x] **Task 10: Tauri Configuration + Build Pipeline** — Add agent-sidecar to tauri.conf.json resources. Add build:sidecar and prebuild scripts to package.json.

- [ ] **Task 11: Integration Test** — Build everything, run tests, verify sidecar starts, verify graph context injection works. Fix any issues.

---

## Done Criteria

When ALL tasks above are checked `[x]`, output "RALPH_DONE" and exit.
