# Decision/Audit Merge + CLI Detection — Ralph Plan

## How This Plan Works

You are an autonomous agent running in a loop. Each time you start:

1. Read this file to find the next unchecked task (marked `- [ ]`)
2. Implement ONLY that one task
3. Run `npm run test` to verify no regressions
4. Mark the task as done by changing `- [ ]` to `- [x]` in this file
5. Commit all changes (including the updated RALPH-PLAN.md) with a descriptive message
6. If ALL tasks are now checked, output RALPH_DONE
7. Exit — do not proceed to the next task

## Rules

- Work from the repo root
- Read existing code before modifying it
- Follow patterns in CLAUDE.md
- Do NOT skip steps or combine tasks

---

## Part 1: Merge Decision + Audit into Unified Events

- [x] **1a: Create unified events table in SQLite** — In `src-tauri/src/db.rs`, add a new migration that creates an `events` table: `id TEXT PRIMARY KEY, session_id TEXT, timestamp TEXT, kind TEXT NOT NULL ('action' or 'decision'), action_type TEXT, detail TEXT, actor TEXT ('agent'/'user'/'system'), metadata TEXT, rationale TEXT, confidence REAL, impact_category TEXT, reversible INTEGER, related_files TEXT, related_tickets TEXT`. Keep the old `audit_log` and `decisions` tables for now (migration compatibility). Add the migration to the version check.

- [x] **1b: Create unified events Rust commands** — Create `src-tauri/src/commands/events_commands.rs` with: `log_event(session_id, kind, action_type, detail, actor, metadata, rationale?, confidence?, impact_category?, reversible?, related_files?, related_tickets?)` that inserts into the `events` table. Add `get_events(session_id, kind?, limit?)` that queries with optional kind filter. Add `export_events(session_id, format, output_path)`. Register all three in `mod.rs` and `lib.rs`.

- [x] **1c: Update graph population for unified events** — In `src-tauri/src/graph/population.rs`, add `populate_event()` that creates a single `event` node type in SurrealDB with all fields. It should create edges to session (`occurred_in`), modified files (`modified`), tickets (`addresses`), and active skills (`informed_by` — only for decisions). Update `src-tauri/src/graph/schema.rs` to add the `event` table and index.

- [x] **1d: Update graph queries for unified events** — In `src-tauri/src/graph/queries.rs`, update `get_session_report()` to query from the `event` table instead of separate `action` and `decision` tables. Update `get_provenance()` to look at `event` nodes where `kind = 'decision'` instead of the `decision` table.

- [x] **1e: Create frontend EventSlice** — Create `src/stores/slices/eventSlice.ts` with: `events: VibeEvent[]`, `eventsLoading: boolean`, `loadEvents(sessionId, kind?, limit?)`, `logEvent(...)`, `exportEvents(...)`. The `VibeEvent` type: `{ id, sessionId, timestamp, kind: 'action' | 'decision', actionType, detail, actor, metadata, rationale?, confidence?, impactCategory?, reversible?, relatedFiles?, relatedTickets? }`. Add to `types.ts` and compose into store in `index.ts`.

- [x] **1f: Add TypeScript command wrappers** — In `src/lib/tauri.ts`, add wrappers: `logEvent(...)`, `getEvents(sessionId, kind?, limit?)`, `exportEvents(sessionId, format, outputPath)`. These call the new Rust commands.

- [x] **1g: Update vibe_record_decision MCP tool** — In `src-tauri/src/services/tool_handler.rs`, update the `vibe_record_decision` handler to call `events_commands::log_event()` with `kind = "decision"` instead of `populate_decision()`. Also call `populate_event()` for graph population.

- [ ] **1h: Update agent_commands_v2 audit logging** — In `src-tauri/src/commands/agent_commands_v2.rs` and `claude_commands.rs`, replace any calls to `log_action()` or `log_to_audit()` with calls to `events_commands::log_event()` with `kind = "action"`.

## Part 2: Auto-Detect Available CLIs

- [ ] **2a: Add CLI detection command** — In `src-tauri/src/commands/agent_commands_v2.rs`, add a new command `detect_available_clis() -> Vec<CliInfo>` where `CliInfo` has `name: String, version: String, path: String`. Check for: git, gh, aws, docker, kubectl, node, npm, python, cargo, pip, terraform, gcloud. For each, run `<cli> --version` and capture the output. Return only the ones found. Register in `lib.rs`.

- [ ] **2b: Inject CLI info into system prompt** — In `src-tauri/src/commands/agent_commands_v2.rs`, update `start_agent()` to call `detect_available_clis()` and format the results as a line in the system prompt: `"\n\n## Available CLIs\nYou have access to these command-line tools: git (2.44.0), gh (2.45.0), node (22.0.0), ..."`. Append this to `full_system_prompt` before sending to the sidecar.

- [ ] **2c: Add CLI info TypeScript wrapper and display** — Add `detectAvailableClis()` wrapper in `src/lib/tauri.ts` or `src/lib/agentCommands.ts`. In `src/components/layout/TitleBar.tsx`, add a small info badge next to the existing repo/skill badges that shows the count of available CLIs with a tooltip listing them. Call `detectAvailableClis()` on app startup and cache the result in a simple React state or Zustand slice.

---

## Done Criteria

When ALL tasks above are checked `[x]`, output "RALPH_DONE" and exit.
