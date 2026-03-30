# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Full dev mode (Vite frontend + Tauri Rust backend, hot-reloads both)
npm run tauri dev

# Frontend-only dev server (port 1420, no Rust backend)
npm run dev

# Production build (TypeScript check + Vite bundle + Rust compile)
npm run tauri build

# Frontend type check + bundle only
npm run build
```

## Testing

```bash
npm run test          # Frontend tests (Vitest, ~43 tests)
npm run test:watch    # Frontend tests in watch mode
npm run test:rust     # Rust backend tests (cargo test --lib)
npm run test:all      # Both frontend + Rust tests
```

Frontend tests live next to their source files (e.g., `agentSlice.test.ts`, `eventParser.test.ts`). Tests use real captured Claude CLI output as fixtures.

## Architecture

**Tauri v2 desktop app**: Rust backend (`src-tauri/`) + React/TypeScript frontend (`src/`).

### Rust Backend (`src-tauri/src/`)

- **`lib.rs`** — Tauri Builder setup, plugin registration, DB initialization, all 66+ command registrations via `generate_handler![]`
- **`db.rs`** — SQLite init (WAL mode), migration system using `PRAGMA user_version` (currently 6 versions)
- **`commands/`** — 13 modules of `#[tauri::command]` functions. Each new command must be registered in `lib.rs`'s `invoke_handler`
- **`graph/`** — SurrealDB embedded graph (kv-surrealkv). Schema is SCHEMALESS (no field type definitions). Key files: `schema.rs` (table/index definitions), `nodes.rs`/`edges.rs` (CRUD), `queries.rs` (composite queries like provenance/impact), `population.rs` (populate from events)
- **`services/event_stream.rs`** — Parses Claude CLI `stream-json --verbose` stdout into typed `AgentEvent`s, emits via Tauri event `"claude-stream"`

**Data locations** (auto-created on first launch):
- SQLite: `~/.vibe-os/vibe-os.db` (via `appDataDir`)
- SurrealDB graph: `~/.vibe-os/graph/` (via `appDataDir`)
- Skills: `~/.vibe-os/skills/` (bundled .md files copied from `src-tauri/skills/`)

### Frontend (`src/`)

- **State**: Single Zustand store (`stores/index.ts`) composed from 16 slices in `stores/slices/`. Types live in `stores/types.ts`. Persisted to SQLite via custom `tauriSqliteStorage` adapter in `stores/storage.ts` (only persists `activeSession` and `sessionGoal`)
- **IPC**: All Tauri `invoke()` calls wrapped in typed `commands` object in `lib/tauri.ts`. This is the single bridge between frontend and backend — every Rust command has a corresponding TypeScript wrapper here
- **Event streaming**: `hooks/useClaudeStream.ts` listens to `"claude-stream"` Tauri events, parses them, updates `agentSlice` with chat messages and rich cards (outcome, error, activity, decision, preview, test-detail)
- **Event parsing**: `lib/eventParser.ts` — type guards (`isStatusEvent`, `isAgentEvent`, `isAssistantText`) and extractors (code blocks, dev server URLs, test results for Jest/Vitest/pytest/Rust)

### Key Patterns

- **Adding a new Tauri command**: Create function in appropriate `commands/*.rs` module, then register it in `lib.rs`'s `generate_handler![]` macro, then add typed wrapper in `src/lib/tauri.ts`
- **Adding a new Zustand slice**: Create in `stores/slices/`, add types to `stores/types.ts`, compose into `stores/index.ts`
- **Rich conversation cards**: Inline cards (OutcomeCard, ErrorCard, etc.) are inserted into chat via `agentSlice.insertRichCard()`. Card types defined in `agentSlice`, rendered in `components/conversation/`
- **Multi-session**: Each Claude subprocess gets a `claude_session_id`. Events are tagged with this ID for routing to the correct tab. Frontend tracks `activeClaudeSessionId`
- **Graph schema changes**: Edit `graph/schema.rs`. All tables are SCHEMALESS — avoid SCHEMAFULL or typed field definitions (SurrealDB 3.x coercion issues). Use string IDs, not `record<T>` types

### Layout Structure

- **Home view**: Project card grid (`components/home/`) — max 5 projects
- **Conversation view**: Full-width chat (`components/panels/ClaudeChat.tsx`) with collapsible settings panel (right, `components/settings/SettingsPanel.tsx` with 7 tabs) and editor panel (bottom, `Ctrl+Shift+C`)
- **Custom title bar**: `components/layout/TitleBar.tsx` — decorations disabled in `tauri.conf.json`

## Tech Stack

- **Frontend**: React 18, TypeScript 5.5, Zustand 5, Tailwind CSS 4, Vite 6, Monaco Editor, D3.js (graph viz)
- **Backend**: Rust 1.89+, Tauri 2, rusqlite 0.32 (bundled), SurrealDB 3.0 (embedded kv-surrealkv), tokio, notify (file watcher)
- **App ID**: `com.vibeos.app`
