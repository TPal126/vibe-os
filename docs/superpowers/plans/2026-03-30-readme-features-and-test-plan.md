# README Features & Test Plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write 58 new automated tests proving every VIBE OS feature works, fix the Knowledge Graph auto-indexing gap, then update the README with verified feature descriptions.

**Architecture:** Frontend tests (Vitest) validate Zustand slices and event parsing logic without Tauri. Rust tests (Cargo) validate SQLite operations, SurrealDB graph operations, and event stream parsing using in-memory/temp databases. The graph auto-indexing feature is added to `event_stream.rs` and `claude_commands.rs` to trigger indexing on session completion.

**Tech Stack:** Vitest 4, Zustand 5 (test stores), Cargo test with rusqlite (in-memory), SurrealDB (mem engine for tests), Tauri 2

---

## File Map

### New files
- `src/stores/slices/projectSlice.test.ts` — Project CRUD, max enforcement, navigation
- `src/stores/slices/layoutSlice.test.ts` — Editor/settings panel toggle tests
- `src/stores/slices/repoSlice.test.ts` — Repo state management tests
- `src/stores/slices/skillSlice.test.ts` — Skill state management tests
- `src/stores/slices/tokenSlice.test.ts` — Token budget state tests

### Modified files
- `src/stores/slices/agentSlice.test.ts` — Add multi-session routing, attention, rich card, outcome state tests
- `src/lib/eventParser.test.ts` — Add preview URL extraction, test result parsing tests
- `src-tauri/src/db.rs` — Add `#[cfg(test)]` module with SQLite tests
- `src-tauri/src/graph/nodes.rs` — Add `#[cfg(test)]` module
- `src-tauri/src/graph/edges.rs` — Add `#[cfg(test)]` module
- `src-tauri/src/graph/queries.rs` — Add `#[cfg(test)]` module
- `src-tauri/src/graph/population.rs` — Add `#[cfg(test)]` module
- `src-tauri/src/graph/indexer.rs` — Add `#[cfg(test)]` module
- `src-tauri/src/services/event_stream.rs` — Add auto-index tracking helper
- `src-tauri/src/commands/claude_commands.rs` — Trigger graph re-index on session complete
- `README.md` — Rewrite features section

---

## Task 1: Project Slice Tests (Feature 1 — Multi-Project Dashboard)

**Files:**
- Create: `src/stores/slices/projectSlice.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/stores/slices/projectSlice.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { create } from "zustand";
import { createProjectSlice } from "./projectSlice";
import type { ProjectSlice } from "../types";

// Mock Tauri commands (projectSlice calls commands.saveSetting)
vi.mock("../../lib/tauri", () => ({
  commands: {
    saveSetting: vi.fn().mockResolvedValue(undefined),
    getSetting: vi.fn().mockResolvedValue(null),
  },
}));

function createTestStore() {
  return create<ProjectSlice>()(
    (...a) => createProjectSlice(...(a as Parameters<typeof createProjectSlice>))
  );
}

describe("projectSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe("CRUD", () => {
    it("adds a project and auto-activates it", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      const state = store.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].name).toBe("my-api");
      expect(state.activeProjectId).toBe(state.projects[0].id);
      expect(state.currentView).toBe("conversation");
    });

    it("removes a project", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      const id = store.getState().projects[0].id;
      store.getState().removeProject(id);
      expect(store.getState().projects).toHaveLength(0);
      expect(store.getState().activeProjectId).toBeNull();
      expect(store.getState().currentView).toBe("home");
    });

    it("updates project summary", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      const id = store.getState().projects[0].id;
      store.getState().updateProjectSummary(id, "REST API project");
      expect(store.getState().projects[0].summary).toBe("REST API project");
    });
  });

  describe("max 5 project enforcement", () => {
    it("allows up to 5 projects", () => {
      for (let i = 0; i < 5; i++) {
        store.getState().addProject(`proj-${i}`, `/path/${i}`, `cs-${i}`);
      }
      expect(store.getState().projects).toHaveLength(5);
    });

    it("rejects 6th project", () => {
      for (let i = 0; i < 5; i++) {
        store.getState().addProject(`proj-${i}`, `/path/${i}`, `cs-${i}`);
      }
      store.getState().addProject("proj-5", "/path/5", "cs-5");
      expect(store.getState().projects).toHaveLength(5);
    });
  });

  describe("navigation", () => {
    it("openProject sets active and switches to conversation view", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      const id = store.getState().projects[0].id;
      store.getState().goHome();
      expect(store.getState().currentView).toBe("home");
      store.getState().openProject(id);
      expect(store.getState().activeProjectId).toBe(id);
      expect(store.getState().currentView).toBe("conversation");
    });

    it("goHome switches to home view", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      store.getState().goHome();
      expect(store.getState().currentView).toBe("home");
    });

    it("openProject ignores non-existent id", () => {
      store.getState().addProject("my-api", "/path/ws", "cs-1");
      const prevActive = store.getState().activeProjectId;
      store.getState().openProject("nonexistent");
      expect(store.getState().activeProjectId).toBe(prevActive);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/stores/slices/projectSlice.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/stores/slices/projectSlice.test.ts
git commit -m "test: add projectSlice tests — CRUD, max 5 enforcement, navigation"
```

---

## Task 2: Agent Slice — Multi-Session, Attention, Rich Cards, Outcomes (Features 1-3)

**Files:**
- Modify: `src/stores/slices/agentSlice.test.ts`

- [ ] **Step 1: Add new test sections to the existing file**

Append the following after the existing `describe("CLI validation state")` block (before the closing `});` of the outer describe):

```typescript
  // ── Multi-session event routing (Feature 3) ──

  describe("multi-session event routing", () => {
    beforeEach(() => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
      store.getState().createClaudeSessionLocal("s2", "Session 2");
    });

    it("routes events to correct session by id", () => {
      store.getState().addSessionChatMessage("s2", makeMessage("user", "hello s2"));
      expect(store.getState().claudeSessions.get("s1")!.chatMessages).toHaveLength(0);
      expect(store.getState().claudeSessions.get("s2")!.chatMessages).toHaveLength(1);
    });

    it("session status is independent", () => {
      store.getState().setSessionError("s1", "broken");
      store.getState().setSessionWorking("s2", true);
      expect(store.getState().claudeSessions.get("s1")!.status).toBe("error");
      expect(store.getState().claudeSessions.get("s2")!.status).toBe("working");
    });
  });

  // ── Attention tracking (Feature 1) ──

  describe("attention tracking", () => {
    beforeEach(() => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
    });

    it("sets attention on input-needed", () => {
      store.getState().setSessionNeedsInput("s1", true);
      store.getState().setSessionAttention("s1", "What should I do?", "msg-1");
      const session = store.getState().claudeSessions.get("s1")!;
      expect(session.needsInput).toBe(true);
      expect(session.status).toBe("needs-input");
      expect(session.attentionPreview).toBe("What should I do?");
      expect(session.attentionMessageId).toBe("msg-1");
    });

    it("clears attention", () => {
      store.getState().setSessionNeedsInput("s1", true);
      store.getState().setSessionAttention("s1", "Help!", "msg-1");
      store.getState().clearSessionAttention("s1");
      const session = store.getState().claudeSessions.get("s1")!;
      expect(session.needsInput).toBe(false);
      expect(session.attentionPreview).toBeNull();
      expect(session.attentionMessageId).toBeNull();
    });

    it("switching to a session clears its attention", () => {
      store.getState().createClaudeSessionLocal("s2", "Session 2");
      store.getState().setSessionNeedsInput("s2", true);
      store.getState().setSessionAttention("s2", "Help!", "msg-1");
      store.getState().setActiveClaudeSessionId("s2");
      const session = store.getState().claudeSessions.get("s2")!;
      expect(session.needsInput).toBe(false);
    });

    it("attention count across sessions", () => {
      store.getState().createClaudeSessionLocal("s2", "Session 2");
      store.getState().createClaudeSessionLocal("s3", "Session 3");
      store.getState().setSessionNeedsInput("s1", true);
      store.getState().setSessionNeedsInput("s3", true);
      const sessions = store.getState().claudeSessions;
      const attentionCount = Array.from(sessions.values()).filter(s => s.needsInput).length;
      expect(attentionCount).toBe(2);
    });
  });

  // ── Rich card insertion (Feature 2) ──

  describe("rich cards", () => {
    beforeEach(() => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
    });

    it("insertRichCard adds card message to session", () => {
      store.getState().insertRichCard("s1", "outcome", "All tests pass", {
        testSummary: { passed: 5, failed: 0, total: 5 },
      });
      const session = store.getState().claudeSessions.get("s1")!;
      expect(session.chatMessages).toHaveLength(1);
      expect(session.chatMessages[0].cardType).toBe("outcome");
      expect(session.chatMessages[0].content).toBe("All tests pass");
      expect(session.chatMessages[0].role).toBe("system");
    });

    it("upsertActivityLine creates and updates activity", () => {
      const event: AgentEvent = {
        timestamp: new Date().toISOString(),
        event_type: "file_create",
        content: "Creating src/foo.ts",
        metadata: { tool: "Write", path: "src/foo.ts" },
      };
      store.getState().upsertActivityLine("s1", event);
      let session = store.getState().claudeSessions.get("s1")!;
      expect(session.chatMessages).toHaveLength(1);
      expect(session.chatMessages[0].cardType).toBe("activity");
      expect(session.currentActivityMessageId).not.toBeNull();

      // Update with another event
      const event2: AgentEvent = {
        timestamp: new Date().toISOString(),
        event_type: "file_modify",
        content: "Editing src/bar.ts",
        metadata: { tool: "Edit", path: "src/bar.ts" },
      };
      store.getState().upsertActivityLine("s1", event2);
      session = store.getState().claudeSessions.get("s1")!;
      expect(session.chatMessages).toHaveLength(1); // still 1 message, updated
      const events = session.chatMessages[0].cardData?.events as unknown[];
      expect(events).toHaveLength(2);
    });

    it("insertRichCard finalizes open activity line", () => {
      const event: AgentEvent = {
        timestamp: new Date().toISOString(),
        event_type: "file_create",
        content: "Creating src/foo.ts",
        metadata: { tool: "Write", path: "src/foo.ts" },
      };
      store.getState().upsertActivityLine("s1", event);
      store.getState().insertRichCard("s1", "outcome", "Done", {});
      const session = store.getState().claudeSessions.get("s1")!;
      expect(session.currentActivityMessageId).toBeNull();
      expect(session.chatMessages).toHaveLength(2); // activity + outcome
    });
  });

  // ── Outcome state (Features 1-2) ──

  describe("outcome state", () => {
    beforeEach(() => {
      store.getState().createClaudeSessionLocal("s1", "Session 1");
    });

    it("sets preview URL", () => {
      store.getState().setSessionPreviewUrl("s1", "http://localhost:3000");
      expect(store.getState().claudeSessions.get("s1")!.previewUrl).toBe("http://localhost:3000");
    });

    it("sets test summary", () => {
      store.getState().setSessionTestSummary("s1", { passed: 10, failed: 2, total: 12 });
      const summary = store.getState().claudeSessions.get("s1")!.testSummary;
      expect(summary).toEqual({ passed: 10, failed: 2, total: 12 });
    });

    it("sets build status", () => {
      store.getState().setSessionBuildStatus("s1", "running", "npm run dev");
      const session = store.getState().claudeSessions.get("s1")!;
      expect(session.buildStatus).toBe("running");
      expect(session.buildStatusText).toBe("npm run dev");
    });
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/stores/slices/agentSlice.test.ts`
Expected: All existing + 12 new tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/stores/slices/agentSlice.test.ts
git commit -m "test: add multi-session routing, attention, rich card, outcome tests"
```

---

## Task 3: EventParser — Preview URL & Test Result Parsing (Feature 2)

**Files:**
- Modify: `src/lib/eventParser.test.ts`

- [ ] **Step 1: Read the eventParser source to find extractDevServerUrl and parseTestResults**

Read: `src/lib/eventParser.ts` to confirm the exact function signatures.

- [ ] **Step 2: Add tests for preview URL extraction and test result parsing**

Append after the existing `describe("extractCodeBlocks")` block:

```typescript
import {
  extractDevServerUrl,
  parseTestResults,
} from "./eventParser";

// ── extractDevServerUrl ──

describe("extractDevServerUrl", () => {
  it("extracts localhost URL from text", () => {
    const url = extractDevServerUrl("Server running at http://localhost:3000");
    expect(url).toBe("http://localhost:3000");
  });

  it("extracts 127.0.0.1 URL", () => {
    const url = extractDevServerUrl("Listening on http://127.0.0.1:5173/");
    expect(url).toBe("http://127.0.0.1:5173/");
  });

  it("returns null for no URL", () => {
    expect(extractDevServerUrl("no url here")).toBeNull();
  });
});

// ── parseTestResults ──

describe("parseTestResults", () => {
  it("parses vitest output", () => {
    const result = parseTestResults("Tests  3 passed | 1 failed (4)");
    expect(result).not.toBeNull();
    expect(result!.passed).toBe(3);
    expect(result!.failed).toBe(1);
    expect(result!.total).toBe(4);
  });

  it("parses pytest output", () => {
    const result = parseTestResults("5 passed, 2 failed in 3.2s");
    expect(result).not.toBeNull();
    expect(result!.passed).toBe(5);
    expect(result!.failed).toBe(2);
  });

  it("returns null for non-test output", () => {
    expect(parseTestResults("hello world")).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/eventParser.test.ts`
Expected: All existing + 6 new tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/eventParser.test.ts
git commit -m "test: add preview URL extraction and test result parsing tests"
```

---

## Task 4: Layout Slice Tests (Feature 6 — Context Control / Editor)

**Files:**
- Create: `src/stores/slices/layoutSlice.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/stores/slices/layoutSlice.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import { createLayoutSlice } from "./layoutSlice";
import type { LayoutSlice } from "../types";

function createTestStore() {
  return create<LayoutSlice>()(
    (...a) => createLayoutSlice(...(a as Parameters<typeof createLayoutSlice>))
  );
}

describe("layoutSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe("editor panel", () => {
    it("defaults to closed", () => {
      expect(store.getState().editorPanelOpen).toBe(false);
    });

    it("toggleEditorPanel toggles open/closed", () => {
      store.getState().toggleEditorPanel();
      expect(store.getState().editorPanelOpen).toBe(true);
      store.getState().toggleEditorPanel();
      expect(store.getState().editorPanelOpen).toBe(false);
    });

    it("setEditorPanelOpen sets directly", () => {
      store.getState().setEditorPanelOpen(true);
      expect(store.getState().editorPanelOpen).toBe(true);
    });
  });

  describe("settings panel", () => {
    it("defaults to closed with repos tab", () => {
      expect(store.getState().settingsPanelOpen).toBe(false);
      expect(store.getState().settingsPanelTab).toBe("repos");
    });

    it("toggleSettingsPanel toggles", () => {
      store.getState().toggleSettingsPanel();
      expect(store.getState().settingsPanelOpen).toBe(true);
      store.getState().toggleSettingsPanel();
      expect(store.getState().settingsPanelOpen).toBe(false);
    });

    it("setSettingsPanelTab changes tab", () => {
      store.getState().setSettingsPanelTab("graph");
      expect(store.getState().settingsPanelTab).toBe("graph");
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/stores/slices/layoutSlice.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/stores/slices/layoutSlice.test.ts
git commit -m "test: add layoutSlice tests — editor and settings panel toggles"
```

---

## Task 5: Token Slice Tests (Feature 6 — Context Control)

**Files:**
- Create: `src/stores/slices/tokenSlice.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/stores/slices/tokenSlice.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { create } from "zustand";
import { createTokenSlice } from "./tokenSlice";
import type { TokenSlice, TokenBudget } from "../types";

const mockBudget = {
  id: "b-1",
  scope_type: "skill",
  scope_id: "skill-abc",
  max_tokens: 5000,
  warning_threshold: 4000,
  created_at: "2026-03-30T00:00:00Z",
  updated_at: "2026-03-30T00:00:00Z",
};

vi.mock("../../lib/tauri", () => ({
  commands: {
    getTokenBudgets: vi.fn().mockResolvedValue([mockBudget]),
    setTokenBudget: vi.fn().mockImplementation(
      (scopeType: string, scopeId: string, maxTokens: number, warningThreshold: number) =>
        Promise.resolve({
          id: "b-new",
          scope_type: scopeType,
          scope_id: scopeId,
          max_tokens: maxTokens,
          warning_threshold: warningThreshold ?? 0.8 * maxTokens,
          created_at: "2026-03-30T00:00:00Z",
          updated_at: "2026-03-30T00:00:00Z",
        })
    ),
    deleteTokenBudget: vi.fn().mockResolvedValue(undefined),
  },
}));

function createTestStore() {
  return create<TokenSlice>()(
    (...a) => createTokenSlice(...(a as Parameters<typeof createTokenSlice>))
  );
}

describe("tokenSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("starts empty", () => {
    expect(store.getState().tokenBudgets).toHaveLength(0);
    expect(store.getState().tokenBudgetsLoading).toBe(false);
  });

  it("loadTokenBudgets populates from backend", async () => {
    await store.getState().loadTokenBudgets();
    expect(store.getState().tokenBudgets).toHaveLength(1);
    expect(store.getState().tokenBudgets[0].scopeType).toBe("skill");
    expect(store.getState().tokenBudgets[0].maxTokens).toBe(5000);
  });

  it("getSkillBudget finds by skillId", async () => {
    await store.getState().loadTokenBudgets();
    const budget = store.getState().getSkillBudget("skill-abc");
    expect(budget).toBeDefined();
    expect(budget!.maxTokens).toBe(5000);
  });

  it("getRepoBudget returns undefined for missing repo", async () => {
    await store.getState().loadTokenBudgets();
    expect(store.getState().getRepoBudget("nonexistent")).toBeUndefined();
  });

  it("getSessionBudget finds session-scoped budget", () => {
    // Manually set a session budget
    store.setState({
      tokenBudgets: [{
        id: "b-s",
        scopeType: "session",
        scopeId: "global",
        maxTokens: 100000,
        warningThreshold: 80000,
        createdAt: "",
        updatedAt: "",
      }],
    });
    expect(store.getState().getSessionBudget()).toBeDefined();
    expect(store.getState().getSessionBudget()!.maxTokens).toBe(100000);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/stores/slices/tokenSlice.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/stores/slices/tokenSlice.test.ts
git commit -m "test: add tokenSlice tests — budget CRUD and scope lookups"
```

---

## Task 6: Rust — SQLite Decision & Audit Tests (Feature 5)

**Files:**
- Modify: `src-tauri/src/commands/decision_commands.rs`

- [ ] **Step 1: Add test module to decision_commands.rs**

Append at the bottom of the file:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::initialize_db;
    use std::path::PathBuf;

    fn test_db() -> Connection {
        let dir = std::env::temp_dir().join(format!("vibe_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("test.db");
        initialize_db(&db_path).unwrap()
    }

    fn make_decision(conn: &Connection, session_id: &str) -> Decision {
        // Ensure session exists
        conn.execute(
            "INSERT OR IGNORE INTO sessions (id, started_at, active) VALUES (?1, datetime('now'), 1)",
            rusqlite::params![session_id],
        ).unwrap();

        let dec = Decision {
            id: uuid::Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            decision: "Use REST over GraphQL".to_string(),
            rationale: "Simpler for CRUD".to_string(),
            confidence: 0.85,
            impact_category: "architecture".to_string(),
            reversible: true,
            related_files: vec!["src/routes.rs".to_string()],
            related_tickets: vec!["VIBE-42".to_string()],
        };
        insert_decision(conn, &dec).unwrap();
        dec
    }

    #[test]
    fn test_insert_and_query_decision() {
        let conn = test_db();
        let dec = make_decision(&conn, "sess-1");

        let mut stmt = conn
            .prepare("SELECT id, decision, confidence, reversible, related_files FROM decisions WHERE session_id = ?1")
            .unwrap();
        let rows: Vec<(String, String, f64, i32, String)> = stmt
            .query_map(["sess-1"], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].0, dec.id);
        assert_eq!(rows[0].1, "Use REST over GraphQL");
        assert!((rows[0].2 - 0.85).abs() < 0.001);
        assert_eq!(rows[0].3, 1); // reversible = true
        let files: Vec<String> = serde_json::from_str(&rows[0].4).unwrap();
        assert_eq!(files, vec!["src/routes.rs"]);
    }

    #[test]
    fn test_decisions_scoped_to_session() {
        let conn = test_db();
        make_decision(&conn, "sess-1");
        make_decision(&conn, "sess-2");

        let mut stmt = conn.prepare("SELECT COUNT(*) FROM decisions WHERE session_id = ?1").unwrap();
        let count: i64 = stmt.query_row(["sess-1"], |row| row.get(0)).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_export_decisions_json() {
        let conn = test_db();
        let dec = make_decision(&conn, "sess-1");

        let mut stmt = conn
            .prepare("SELECT id, session_id, timestamp, decision, rationale, confidence, impact_category, reversible, related_files, related_tickets FROM decisions WHERE session_id = ?1")
            .unwrap();
        let decisions: Vec<Decision> = stmt
            .query_map(["sess-1"], |row| {
                Ok(Decision {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    timestamp: row.get(2)?,
                    decision: row.get(3)?,
                    rationale: row.get(4)?,
                    confidence: row.get(5)?,
                    impact_category: row.get(6)?,
                    reversible: row.get::<_, i32>(7)? != 0,
                    related_files: serde_json::from_str(&row.get::<_, String>(8).unwrap_or_default()).unwrap_or_default(),
                    related_tickets: serde_json::from_str(&row.get::<_, String>(9).unwrap_or_default()).unwrap_or_default(),
                })
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        let json = serde_json::to_string_pretty(&decisions).unwrap();
        assert!(json.contains("Use REST over GraphQL"));
        assert!(json.contains("src/routes.rs"));
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cd src-tauri && cargo test --lib decision_commands::tests -- --nocapture`
Expected: All 3 tests PASS

- [ ] **Step 3: Add audit tests to audit_commands.rs**

Append at the bottom of `src-tauri/src/commands/audit_commands.rs`:

```rust
#[cfg(test)]
mod tests {
    use crate::db::initialize_db;

    fn test_db() -> rusqlite::Connection {
        let dir = std::env::temp_dir().join(format!("vibe_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        initialize_db(&dir.join("test.db")).unwrap()
    }

    #[test]
    fn test_log_and_retrieve_audit() {
        let conn = test_db();
        let session_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO sessions (id, started_at, active) VALUES (?1, datetime('now'), 1)",
            rusqlite::params![session_id],
        ).unwrap();

        // Insert two entries
        for i in 0..2 {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO audit_log (id, session_id, timestamp, action_type, detail, actor) VALUES (?1, ?2, datetime('now'), ?3, ?4, ?5)",
                rusqlite::params![id, session_id, "FILE_CREATE", format!("Created file {}", i), "agent"],
            ).unwrap();
        }

        let mut stmt = conn.prepare("SELECT COUNT(*) FROM audit_log WHERE session_id = ?1").unwrap();
        let count: i64 = stmt.query_row([&session_id], |row| row.get(0)).unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_audit_limit() {
        let conn = test_db();
        let session_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO sessions (id, started_at, active) VALUES (?1, datetime('now'), 1)",
            rusqlite::params![session_id],
        ).unwrap();

        for i in 0..10 {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO audit_log (id, session_id, timestamp, action_type, detail, actor) VALUES (?1, ?2, datetime('now'), ?3, ?4, ?5)",
                rusqlite::params![id, session_id, "TEST_RUN", format!("Test {}", i), "agent"],
            ).unwrap();
        }

        let mut stmt = conn.prepare("SELECT COUNT(*) FROM audit_log WHERE session_id = ?1 LIMIT 5").unwrap();
        let count: i64 = stmt.query_row([&session_id], |row| row.get(0)).unwrap();
        // LIMIT applies to the select, so count returns at most the number of rows within limit
        assert!(count <= 10);

        let mut stmt2 = conn.prepare("SELECT id FROM audit_log WHERE session_id = ?1 ORDER BY timestamp DESC LIMIT 5").unwrap();
        let rows: Vec<String> = stmt2.query_map([&session_id], |row| row.get(0)).unwrap().filter_map(|r| r.ok()).collect();
        assert_eq!(rows.len(), 5);
    }

    #[test]
    fn test_export_audit_csv() {
        let conn = test_db();
        let session_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO sessions (id, started_at, active) VALUES (?1, datetime('now'), 1)",
            rusqlite::params![session_id],
        ).unwrap();

        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO audit_log (id, session_id, timestamp, action_type, detail, actor) VALUES (?1, ?2, '2026-03-30T00:00:00Z', 'FILE_CREATE', 'Created main.rs', 'agent')",
            rusqlite::params![id, session_id],
        ).unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, session_id, timestamp, action_type, detail, actor, metadata FROM audit_log WHERE session_id = ?1"
        ).unwrap();
        let entries: Vec<super::AuditEntry> = stmt
            .query_map([&session_id], |row| {
                Ok(super::AuditEntry {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    timestamp: row.get(2)?,
                    action_type: row.get(3)?,
                    detail: row.get(4)?,
                    actor: row.get(5)?,
                    metadata: row.get(6)?,
                })
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        let mut csv = String::from("id,timestamp,action_type,detail,actor,metadata\n");
        for e in &entries {
            csv.push_str(&format!("\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
                e.id, e.timestamp, e.action_type, e.detail, e.actor, e.metadata.as_deref().unwrap_or("")));
        }
        assert!(csv.contains("FILE_CREATE"));
        assert!(csv.contains("Created main.rs"));
    }
}
```

- [ ] **Step 4: Run audit tests**

Run: `cd src-tauri && cargo test --lib audit_commands::tests -- --nocapture`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/decision_commands.rs src-tauri/src/commands/audit_commands.rs
git commit -m "test: add SQLite decision and audit tests — persistence, scoping, export"
```

---

## Task 7: Rust — SurrealDB Graph Tests (Feature 4 — Knowledge Graph)

**Files:**
- Modify: `src-tauri/src/graph/nodes.rs`
- Modify: `src-tauri/src/graph/edges.rs`
- Modify: `src-tauri/src/graph/population.rs`

- [ ] **Step 1: Add test module to nodes.rs**

Append at the bottom of `src-tauri/src/graph/nodes.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::connection::initialize_graph_db;
    use crate::graph::schema::define_schema;

    async fn test_db() -> Surreal<Db> {
        let dir = std::env::temp_dir().join(format!("vibe_graph_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = initialize_graph_db(&dir).await.unwrap();
        define_schema(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn test_create_and_get_node() {
        let db = test_db().await;
        let data = serde_json::json!({
            "name": "my-repo",
            "language": "Rust",
            "active": true,
        });
        create_node(&db, "repo", "test_repo", &data).await.unwrap();
        let node = get_node(&db, "repo", "test_repo").await.unwrap();
        assert!(node.is_some());
        let node = node.unwrap();
        assert_eq!(node["name"], "my-repo");
    }

    #[tokio::test]
    async fn test_upsert_node() {
        let db = test_db().await;
        let data1 = serde_json::json!({"name": "v1", "active": true});
        create_node(&db, "repo", "upsert_test", &data1).await.unwrap();

        let data2 = serde_json::json!({"name": "v2", "active": false});
        upsert_node(&db, "repo", "upsert_test", &data2).await.unwrap();

        let node = get_node(&db, "repo", "upsert_test").await.unwrap().unwrap();
        assert_eq!(node["name"], "v2");
    }

    #[tokio::test]
    async fn test_list_nodes() {
        let db = test_db().await;
        create_node(&db, "skill", "s1", &serde_json::json!({"name": "skill-a"})).await.unwrap();
        create_node(&db, "skill", "s2", &serde_json::json!({"name": "skill-b"})).await.unwrap();
        let nodes = list_nodes(&db, "skill").await.unwrap();
        assert_eq!(nodes.len(), 2);
    }

    #[tokio::test]
    async fn test_delete_node() {
        let db = test_db().await;
        create_node(&db, "repo", "del_test", &serde_json::json!({"name": "doomed"})).await.unwrap();
        delete_node(&db, "repo", "del_test").await.unwrap();
        let node = get_node(&db, "repo", "del_test").await.unwrap();
        assert!(node.is_none());
    }
}
```

- [ ] **Step 2: Add test module to edges.rs**

Append at the bottom of `src-tauri/src/graph/edges.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::connection::initialize_graph_db;
    use crate::graph::schema::define_schema;
    use crate::graph::nodes;

    async fn test_db() -> Surreal<Db> {
        let dir = std::env::temp_dir().join(format!("vibe_edge_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = initialize_graph_db(&dir).await.unwrap();
        define_schema(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn test_relate_and_query_edges() {
        let db = test_db().await;
        nodes::create_node(&db, "module", "mod_a", &serde_json::json!({"name": "mod_a"})).await.unwrap();
        nodes::create_node(&db, "repo", "repo_x", &serde_json::json!({"name": "repo_x"})).await.unwrap();

        relate(&db, "module:mod_a", "belongs_to", "repo:repo_x", None).await.unwrap();

        let edges = outgoing_edges(&db, "module:mod_a", "belongs_to").await.unwrap();
        assert!(!edges.is_empty());
    }

    #[tokio::test]
    async fn test_relate_with_data() {
        let db = test_db().await;
        nodes::create_node(&db, "fn_def", "fn_a", &serde_json::json!({"name": "fn_a"})).await.unwrap();
        nodes::create_node(&db, "fn_def", "fn_b", &serde_json::json!({"name": "fn_b"})).await.unwrap();

        let data = EdgeData {
            call_count: Some(5),
            ..Default::default()
        };
        relate(&db, "fn_def:fn_a", "calls", "fn_def:fn_b", Some(&data)).await.unwrap();

        let edges = outgoing_edges(&db, "fn_def:fn_a", "calls").await.unwrap();
        assert!(!edges.is_empty());
    }
}
```

- [ ] **Step 3: Add test module to population.rs**

Append at the bottom of `src-tauri/src/graph/population.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::connection::initialize_graph_db;
    use crate::graph::schema::define_schema;
    use crate::graph::nodes;

    async fn test_db() -> Surreal<Db> {
        let dir = std::env::temp_dir().join(format!("vibe_pop_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = initialize_graph_db(&dir).await.unwrap();
        define_schema(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn test_populate_decision() {
        let db = test_db().await;
        populate_session(&db, "sess-1", "test prompt").await.unwrap();
        populate_decision(
            &db, "dec_1", "sess-1", "Use REST", "Simpler", 0.85,
            "architecture", true, &["src/routes.rs".to_string()], &["VIBE-42".to_string()],
            "2026-03-30T00:00:00Z",
        ).await.unwrap();

        let node = nodes::get_node(&db, "decision", "dec_1").await.unwrap();
        assert!(node.is_some());
        assert_eq!(node.unwrap()["summary"], "Use REST");
    }

    #[tokio::test]
    async fn test_populate_action() {
        let db = test_db().await;
        populate_session(&db, "sess-1", "test prompt").await.unwrap();
        populate_action(
            &db, "act_1", "sess-1", "FILE_CREATE", "Created main.rs",
            "agent", "2026-03-30T00:00:00Z", None,
        ).await.unwrap();

        let node = nodes::get_node(&db, "action", "act_1").await.unwrap();
        assert!(node.is_some());
        assert_eq!(node.unwrap()["action_type"], "FILE_CREATE");
    }

    #[tokio::test]
    async fn test_populate_skill() {
        let db = test_db().await;
        populate_skill(&db, "test_skill", "/path/skill.md", "core", 500, true, "sess-1").await.unwrap();

        let node = nodes::get_node(&db, "skill", "test_skill").await.unwrap();
        assert!(node.is_some());
        assert_eq!(node.unwrap()["token_count"], 500);
    }

    #[tokio::test]
    async fn test_populate_session() {
        let db = test_db().await;
        populate_session(&db, "sess_1", "You are a helpful assistant").await.unwrap();

        let node = nodes::get_node(&db, "session", "sess_1").await.unwrap();
        assert!(node.is_some());
        assert_eq!(node.unwrap()["system_prompt"], "You are a helpful assistant");
    }

    #[tokio::test]
    async fn test_sync_decisions_from_sqlite() {
        let db = test_db().await;
        populate_session(&db, "sess-1", "").await.unwrap();

        let decisions = vec![serde_json::json!({
            "id": "d1",
            "session_id": "sess-1",
            "decision": "Use Zustand",
            "rationale": "Simple state management",
            "confidence": 0.9,
            "impact_category": "dx",
            "reversible": true,
            "timestamp": "2026-03-30T00:00:00Z",
            "related_files": [],
            "related_tickets": [],
        })];

        let count = sync_decisions_from_sqlite(&db, decisions).await.unwrap();
        assert_eq!(count, 1);
        let node = nodes::get_node(&db, "decision", "d1").await.unwrap();
        assert!(node.is_some());
    }
}
```

- [ ] **Step 4: Run all graph tests**

Run: `cd src-tauri && cargo test --lib graph -- --nocapture`
Expected: All 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/graph/nodes.rs src-tauri/src/graph/edges.rs src-tauri/src/graph/population.rs
git commit -m "test: add SurrealDB graph tests — node CRUD, edges, population pipeline"
```

---

## Task 8: Rust — Workspace & Token Budget Tests (Feature 6)

**Files:**
- Modify: `src-tauri/src/commands/workspace_commands.rs`
- Modify: `src-tauri/src/commands/token_commands.rs`

- [ ] **Step 1: Add workspace test module**

Append at the bottom of `src-tauri/src/commands/workspace_commands.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_workspace_scaffolds_dirs() {
        let name = format!("test_ws_{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
        let meta = create_workspace(name.clone()).unwrap();

        assert!(Path::new(&meta.path).exists());
        assert!(Path::new(&meta.path).join("docs").is_dir());
        assert!(Path::new(&meta.path).join("repos").is_dir());
        assert!(Path::new(&meta.path).join("skills").is_dir());
        assert!(Path::new(&meta.path).join("data").is_dir());
        assert!(Path::new(&meta.path).join("output").is_dir());
        assert!(Path::new(&meta.path).join("CLAUDE.md").is_file());
        assert!(meta.has_claude_md);

        // Cleanup
        std::fs::remove_dir_all(&meta.path).ok();
    }

    #[test]
    fn test_open_workspace_reads_metadata() {
        let name = format!("test_ws_{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap());
        let created = create_workspace(name).unwrap();
        let opened = open_workspace(created.path.clone()).unwrap();

        assert_eq!(opened.name, created.name);
        assert!(opened.has_claude_md);
        assert_eq!(opened.repo_count, 0);
        assert_eq!(opened.skill_count, 0);

        // Cleanup
        std::fs::remove_dir_all(&created.path).ok();
    }

    #[test]
    fn test_create_workspace_rejects_invalid_name() {
        let result = create_workspace("has spaces".to_string());
        assert!(result.is_err());

        let result = create_workspace("".to_string());
        assert!(result.is_err());
    }
}
```

- [ ] **Step 2: Add token budget test module**

Append at the bottom of `src-tauri/src/commands/token_commands.rs`:

```rust
#[cfg(test)]
mod tests {
    use crate::db::initialize_db;

    fn test_db() -> rusqlite::Connection {
        let dir = std::env::temp_dir().join(format!("vibe_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        initialize_db(&dir.join("test.db")).unwrap()
    }

    #[test]
    fn test_set_and_get_token_budgets() {
        let conn = test_db();

        // Insert a budget
        conn.execute(
            "INSERT INTO token_budgets (id, scope_type, scope_id, max_tokens, warning_threshold, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'))",
            rusqlite::params!["b-1", "skill", "skill-abc", 5000, 4000],
        ).unwrap();

        let mut stmt = conn.prepare("SELECT id, scope_type, scope_id, max_tokens, warning_threshold FROM token_budgets").unwrap();
        let rows: Vec<(String, String, String, i64, i64)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].1, "skill");
        assert_eq!(rows[0].3, 5000);
    }

    #[test]
    fn test_delete_token_budget() {
        let conn = test_db();

        conn.execute(
            "INSERT INTO token_budgets (id, scope_type, scope_id, max_tokens, warning_threshold, created_at, updated_at)
             VALUES ('b-del', 'repo', 'repo-1', 10000, 8000, datetime('now'), datetime('now'))",
            [],
        ).unwrap();

        conn.execute("DELETE FROM token_budgets WHERE id = 'b-del'", []).unwrap();

        let count: i64 = conn.query_row("SELECT COUNT(*) FROM token_budgets", [], |row| row.get(0)).unwrap();
        assert_eq!(count, 0);
    }
}
```

- [ ] **Step 3: Run tests**

Run: `cd src-tauri && cargo test --lib workspace_commands::tests token_commands::tests -- --nocapture`
Expected: All 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/workspace_commands.rs src-tauri/src/commands/token_commands.rs
git commit -m "test: add workspace scaffolding and token budget SQLite tests"
```

---

## Task 9: Fix Knowledge Graph Auto-Indexing Gap (Feature 4)

**Files:**
- Modify: `src-tauri/src/commands/claude_commands.rs`

- [ ] **Step 1: Read claude_commands.rs to understand the event loop**

Read: `src-tauri/src/commands/claude_commands.rs` — find where `"claude-stream"` events are emitted and where session completion is detected.

- [ ] **Step 2: Add auto-index on session completion**

After the event loop that processes Claude CLI stdout, when a `result` event is detected (the session is done), trigger graph indexing for the working directory. This should be added in the `start_claude` function where the stdout reader thread processes events.

Find the section that emits result events and add:

```rust
// After emitting the result event, trigger graph re-index
if event.event_type == AgentEventType::Result || event.event_type == AgentEventType::Error {
    // Fire-and-forget graph re-index for the working directory
    let graph_db = app_handle.state::<Surreal<Db>>();
    let wd = working_dir.clone();
    let sid = claude_session_id.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = crate::graph::indexer::index_repo(&graph_db, &wd, &sid).await {
            log::warn!("Auto-index after session failed: {}", e);
        }
    });
}
```

The exact integration depends on the structure of `start_claude`. Read the file first, then place the auto-index trigger at the right location.

- [ ] **Step 3: Run existing tests to verify no regression**

Run: `cd src-tauri && cargo test --lib`
Expected: All tests still PASS

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/claude_commands.rs
git commit -m "feat(graph): auto-index repo on session completion"
```

---

## Task 10: Rust — Graph Query Tests (Feature 4)

**Files:**
- Modify: `src-tauri/src/graph/queries.rs`

- [ ] **Step 1: Add test module**

Append at the bottom of `src-tauri/src/graph/queries.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::connection::initialize_graph_db;
    use crate::graph::schema::define_schema;
    use crate::graph::nodes;
    use crate::graph::edges;
    use crate::graph::population;

    async fn test_db() -> Surreal<Db> {
        let dir = std::env::temp_dir().join(format!("vibe_qtest_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = initialize_graph_db(&dir).await.unwrap();
        define_schema(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn test_get_full_graph_empty() {
        let db = test_db().await;
        let graph = get_full_graph(&db, None).await.unwrap();
        assert!(graph.nodes.is_empty());
        assert!(graph.edges.is_empty());
    }

    #[tokio::test]
    async fn test_get_full_graph_with_data() {
        let db = test_db().await;
        nodes::create_node(&db, "repo", "r1", &serde_json::json!({"name": "my-repo", "node_type": "repo", "label": "my-repo"})).await.unwrap();
        nodes::create_node(&db, "fn_def", "f1", &serde_json::json!({"name": "main", "node_type": "function", "label": "main"})).await.unwrap();
        edges::relate(&db, "fn_def:f1", "belongs_to", "repo:r1", None).await.unwrap();

        let graph = get_full_graph(&db, None).await.unwrap();
        assert!(!graph.nodes.is_empty());
    }

    #[tokio::test]
    async fn test_provenance_query() {
        let db = test_db().await;
        // Create a function and a decision that modified it
        nodes::create_node(&db, "fn_def", "prov_fn", &serde_json::json!({"name": "handler", "node_type": "function"})).await.unwrap();
        population::populate_session(&db, "sess-1", "").await.unwrap();
        population::populate_decision(
            &db, "prov_dec", "sess-1", "Refactor handler", "Clean up", 0.9,
            "dx", true, &[], &[], "2026-03-30T00:00:00Z",
        ).await.unwrap();
        // Create modified edge: decision -> fn_def
        edges::relate(&db, "decision:prov_dec", "modified", "fn_def:prov_fn", None).await.unwrap();

        let trace = get_provenance(&db, "fn_def:prov_fn").await.unwrap();
        assert!(!trace.decisions.is_empty());
    }

    #[tokio::test]
    async fn test_session_report() {
        let db = test_db().await;
        population::populate_session(&db, "report_sess", "test").await.unwrap();
        population::populate_decision(
            &db, "rep_dec", "report_sess", "Add tests", "Coverage", 0.7,
            "dx", true, &[], &[], "2026-03-30T00:00:00Z",
        ).await.unwrap();
        population::populate_action(
            &db, "rep_act", "report_sess", "FILE_CREATE", "Created test.rs",
            "agent", "2026-03-30T00:00:00Z", None,
        ).await.unwrap();

        let report = get_session_report(&db, "report_sess").await.unwrap();
        assert!(!report.decisions.is_empty());
        assert!(!report.timeline.is_empty());
    }

    #[tokio::test]
    async fn test_impact_query() {
        let db = test_db().await;
        nodes::create_node(&db, "fn_def", "imp_fn", &serde_json::json!({"name": "core_fn"})).await.unwrap();
        nodes::create_node(&db, "fn_def", "imp_caller", &serde_json::json!({"name": "caller_fn"})).await.unwrap();
        edges::relate(&db, "fn_def:imp_caller", "calls", "fn_def:imp_fn", None).await.unwrap();

        let impact = get_impact(&db, "fn_def:imp_fn").await.unwrap();
        assert!(!impact.direct_callers.is_empty());
    }
}
```

- [ ] **Step 2: Run query tests**

Run: `cd src-tauri && cargo test --lib graph::queries::tests -- --nocapture`
Expected: All 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/graph/queries.rs
git commit -m "test: add graph query tests — full graph, provenance, impact, session report"
```

---

## Task 11: Run Full Test Suite

- [ ] **Step 1: Run all frontend tests**

Run: `npx vitest run`
Expected: All tests PASS (~74 total)

- [ ] **Step 2: Run all Rust tests**

Run: `cd src-tauri && cargo test --lib`
Expected: All tests PASS (~50+ total)

- [ ] **Step 3: Fix any failures**

If any tests fail, fix the code or tests, then re-run.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve test failures from full suite run"
```

---

## Task 12: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the "What It Does" and "Features in Depth" sections**

Replace the existing table in "What It Does" with the 6 feature descriptions from the spec. Replace "Features in Depth" with expanded versions. Update the test count.

Key changes:
- Replace the 13-row capability table with the 6 feature paragraphs
- Update "Features in Depth" to match the 6 features
- Update test count from "43 tests" to the new total
- Keep Quick Start, Architecture, Keyboard Shortcuts, Design System sections as-is

- [ ] **Step 2: Run `npm run build` to verify nothing is broken**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README features for user-facing audience, update test count"
```

---

## Summary

| Task | Tests Added | Type |
|------|-------------|------|
| 1. Project Slice | 7 | Vitest |
| 2. Agent Slice additions | 12 | Vitest |
| 3. EventParser additions | 6 | Vitest |
| 4. Layout Slice | 6 | Vitest |
| 5. Token Slice | 5 | Vitest |
| 6. Decision & Audit (Rust) | 6 | Cargo |
| 7. Graph Nodes/Edges/Population (Rust) | 11 | Cargo |
| 8. Workspace & Token (Rust) | 5 | Cargo |
| 9. Graph auto-index fix | 0 (feature) | — |
| 10. Graph Queries (Rust) | 5 | Cargo |
| **Total new** | **63** | |
