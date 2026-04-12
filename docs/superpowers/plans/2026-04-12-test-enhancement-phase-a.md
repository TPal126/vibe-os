# Test Enhancement Phase A: Close Core Test Gaps

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the highest-value missing tests — useAgentStream event normalization, pipelineSlice state management, Rust workflow runner integration tests with a temp DB, and a fake backend adapter for deterministic pipeline simulation — plus fixture infrastructure and CI-ready npm scripts.

**Architecture:** Frontend tests use Vitest + jsdom with mocked Tauri IPC. Rust integration tests run against temp SQLite DBs with a `FakeAdapter` that emits scripted event sequences. Fixtures live in dedicated directories at both layers. A `test-fake` Cargo feature flag enables the fake adapter.

**Tech Stack:** Vitest 4, @testing-library/react, jsdom, cargo test, rusqlite (bundled), tempfile (Rust dev-dep)

**Spec:** User-provided test enhancement spec (17 sections). This plan covers Phase A (Sections 1-3 + 5 + 8 partial + 9 partial).

**Sequencing:** Phase A of 4. Phases B (E2E harness), C (persistence/failure hardening), D (real CLI smoke) follow.

---

## File Map

### Frontend — Created
- `src/test-setup.ts` — Vitest global setup (Tauri API mock, crypto polyfill)
- `src/test-fixtures/events/cli-claude-status.json` — Claude CLI status envelope fixture
- `src/test-fixtures/events/cli-claude-think.json` — Claude CLI think event fixture
- `src/test-fixtures/events/cli-claude-result.json` — Claude CLI result event fixture
- `src/test-fixtures/events/cli-codex-result.json` — Codex CLI result event fixture
- `src/test-fixtures/events/phase-transition-gated.json` — Gated phase transition fixture
- `src/test-fixtures/events/phase-transition-auto.json` — Auto phase transition fixture
- `src/test-fixtures/events/interaction-request.json` — Interaction request fixture
- `src/test-fixtures/events/malformed.json` — Malformed payload fixture
- `src/lib/agentStreamNormalizer.ts` — Extracted event normalization logic (pure functions)
- `src/lib/agentStreamNormalizer.test.ts` — Tests for normalization logic
- `src/hooks/useAgentStream.test.tsx` — Hook integration tests
- `src/stores/slices/pipelineSlice.test.ts` — Pipeline slice state tests
- `src/components/conversation/PhaseIndicator.test.tsx` — PhaseIndicator render tests
- `src/components/conversation/GatePromptCard.test.tsx` — GatePromptCard render tests
- `src/components/conversation/InteractionCard.test.tsx` — InteractionCard render/response tests

### Frontend — Modified
- `vitest.config.ts` — Add setup file, coverage config
- `package.json` — Add test scripts, coverage deps
- `src/hooks/useAgentStream.ts` — Import from extracted normalizer

### Rust — Created
- `src-tauri/src/backends/fake.rs` — FakeAdapter implementing BackendAdapter (emits `"cli-claude"` source to match existing contract)
- `src-tauri/test-fixtures/workflows/single-phase-success.json` — Single phase fixture
- `src-tauri/test-fixtures/workflows/gated-three-phase.json` — Gated 3-phase fixture
- `src-tauri/tests/workflow_runner_integration.rs` — **Primary Rust deliverable:** tests start_pipeline, phase progression, gating, and completion using real runner + FakeAdapter + temp DB
- `src-tauri/tests/pipeline_persistence_integration.rs` — Tests real project/pipeline command functions against temp DB
- `src-tauri/tests/test_helpers.rs` — Shared temp DB (calls real `db::run_migrations`), adapter injection helpers

### Rust — Modified
- `src-tauri/Cargo.toml` — Add `tempfile` dev-dep, `test-fake` feature
- `src-tauri/src/backends/mod.rs` — Add `#[cfg(any(test, feature = "test-fake"))] pub mod fake;`
- `src-tauri/src/workflow/runner.rs` — Add injectable adapter dispatch (accepts `&dyn BackendAdapter` or backend name → adapter mapping) so tests can inject FakeAdapter
- `src-tauri/src/db.rs` — Make `run_migrations` pub(crate) so integration tests can call it on temp DBs

---

## Milestone A: Test Infrastructure + Fixtures

### Task 1: Configure Vitest setup, coverage, and npm scripts

**Files:**
- Create: `src/test-setup.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create test-setup.ts**

Create `src/test-setup.ts` — a global setup file that mocks Tauri's IPC layer:

```typescript
import { vi } from "vitest";

// Mock @tauri-apps/api/core (invoke)
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockRejectedValue(new Error("Tauri invoke not mocked for this test")),
}));

// Mock @tauri-apps/api/event (listen)
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

// Ensure crypto.randomUUID is available in jsdom
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      ...globalThis.crypto,
      randomUUID: () =>
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        }),
    },
  });
}
```

- [ ] **Step 2: Update vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.*", "src/test-setup.ts", "src/test-fixtures/**"],
    },
  },
});
```

- [ ] **Step 3: Add npm scripts to package.json**

Add to `"scripts"`:

```json
"test:unit": "vitest run",
"test:coverage": "vitest run --coverage",
"test:ci": "vitest run && cd src-tauri && cargo test --lib && cargo test --tests",
"test:workflow": "vitest run --reporter=verbose src/**/*pipeline*.test.* src/**/*Stream*.test.* src/**/*Phase*.test.* src/**/*Gate*.test.* src/**/*Interaction*.test.*"
```

- [ ] **Step 4: Install coverage provider**

```bash
npm install -D @vitest/coverage-v8
```

- [ ] **Step 5: Run to verify setup works**

Run: `npm run test:unit`
Expected: All existing 104 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/test-setup.ts vitest.config.ts package.json package-lock.json
git commit -m "chore: add Vitest setup file, coverage config, test scripts"
```

### Task 2: Create event fixture files

**Files:**
- Create: 9 fixture JSON files in `src/test-fixtures/events/`

- [ ] **Step 1: Create fixture directory and files**

Create `src/test-fixtures/events/` directory with these files:

**`src/test-fixtures/events/cli-claude-status.json`:**
```json
{
  "type": "status",
  "source": "cli-claude",
  "sessionId": "test-session-1",
  "status": "working"
}
```

**`src/test-fixtures/events/cli-claude-think.json`:**
```json
{
  "type": "agent_event",
  "source": "cli-claude",
  "sessionId": "test-session-1",
  "event": {
    "event_type": "think",
    "content": "Let me analyze that for you.",
    "timestamp": "2026-04-12T00:00:00Z"
  }
}
```

**`src/test-fixtures/events/cli-claude-result.json`:**
```json
{
  "type": "agent_event",
  "source": "cli-claude",
  "sessionId": "test-session-1",
  "event": {
    "event_type": "result",
    "content": "Task completed successfully.",
    "metadata": {
      "input_tokens": 1500,
      "output_tokens": 200,
      "cache_creation_input_tokens": 500,
      "cache_read_input_tokens": 1000,
      "cost_usd": 0.025,
      "duration_ms": 3500,
      "duration_api_ms": 3200
    },
    "timestamp": "2026-04-12T00:00:05Z"
  }
}
```

**`src/test-fixtures/events/cli-codex-result.json`:**
```json
{
  "type": "agent_event",
  "source": "cli-codex",
  "sessionId": "test-session-2",
  "event": {
    "event_type": "result",
    "content": "",
    "metadata": {
      "input_tokens": 10884,
      "output_tokens": 5,
      "cached_input_tokens": 9600,
      "cache_creation_input_tokens": null,
      "cache_read_input_tokens": 9600,
      "cost_usd": null,
      "duration_ms": null,
      "duration_api_ms": null
    },
    "timestamp": "2026-04-12T00:00:05Z"
  }
}
```

**`src/test-fixtures/events/phase-transition-gated.json`:**
```json
{
  "type": "agent_event",
  "source": "workflow",
  "sessionId": "test-session-1",
  "event": {
    "event_type": "phase_transition",
    "content": "Phase 'Planning' complete. Review and continue.",
    "metadata": {
      "gate": "awaiting",
      "next_phase_id": "phase-3",
      "pipeline_run_id": "run-1"
    },
    "timestamp": "2026-04-12T00:01:00Z"
  }
}
```

**`src/test-fixtures/events/phase-transition-auto.json`:**
```json
{
  "type": "agent_event",
  "source": "workflow",
  "sessionId": "test-session-1",
  "event": {
    "event_type": "phase_transition",
    "content": "Phase 'Ideation' complete. Advancing to Planning.",
    "metadata": {
      "pipeline_run_id": "run-1"
    },
    "timestamp": "2026-04-12T00:00:30Z"
  }
}
```

**`src/test-fixtures/events/interaction-request.json`:**
```json
{
  "type": "agent_event",
  "source": "cli-claude",
  "sessionId": "test-session-1",
  "event": {
    "event_type": "interaction_request",
    "content": "What technology stack would you like to use?",
    "metadata": {
      "options": ["React + TypeScript", "Vue + TypeScript", "Svelte"],
      "inputType": "choice"
    },
    "timestamp": "2026-04-12T00:00:10Z"
  }
}
```

**`src/test-fixtures/events/malformed.json`:**
```json
{
  "type": "definitely_not_valid",
  "garbage": true
}
```

**`src/test-fixtures/events/cli-claude-tool.json`:**
```json
{
  "type": "agent_event",
  "source": "cli-claude",
  "sessionId": "test-session-1",
  "event": {
    "event_type": "file_modify",
    "content": "Editing src/main.ts",
    "metadata": {
      "tool": "Edit",
      "path": "src/main.ts"
    },
    "timestamp": "2026-04-12T00:00:03Z"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/test-fixtures/
git commit -m "chore: add event fixture files for frontend tests"
```

---

## Milestone B: Frontend Unit Tests — Event Normalization

### Task 3: Extract event normalization into testable pure functions

**Files:**
- Create: `src/lib/agentStreamNormalizer.ts`
- Modify: `src/hooks/useAgentStream.ts`

The current `useAgentStream.ts` has event-to-store normalization logic deeply nested inside a `listen` callback. Extract it into pure functions that take an event payload and return a list of store mutations. This makes it testable without mounting a React component.

- [ ] **Step 1: Create agentStreamNormalizer.ts**

```typescript
import type { AgentEvent, ChatMessage, ApiMetrics, CardType } from "../stores/types";

// ── Payload types (re-export from useAgentStream for consistency) ──

export interface CliEventPayload {
  type: "agent_event";
  source: "cli-claude" | "cli-codex" | "workflow";
  sessionId: string;
  event: {
    event_type: string;
    content: string;
    metadata?: Record<string, unknown>;
    timestamp: string;
  };
}

export interface CliStatusPayload {
  type: "status";
  source: "cli-claude" | "cli-codex";
  sessionId: string;
  status: "working" | "done" | "cancelled";
}

// ── Mutation descriptors (what the store should do) ──

export type StoreMutation =
  | { type: "createSession"; sessionId: string; name: string; backend: "claude" | "codex" | "sidecar" }
  | { type: "setWorking"; sessionId: string; working: boolean }
  | { type: "appendAssistant"; sessionId: string; text: string }
  | { type: "addAgentEvent"; sessionId: string; event: AgentEvent }
  | { type: "upsertActivity"; sessionId: string; event: AgentEvent }
  | { type: "finalizeActivity"; sessionId: string }
  | { type: "insertCard"; sessionId: string; cardType: CardType; content: string; data: Record<string, unknown> }
  | { type: "setError"; sessionId: string; error: string }
  | { type: "setApiMetrics"; sessionId: string; metrics: ApiMetrics }
  | { type: "refreshPipelineRun"; pipelineRunId: string };

/**
 * Normalize a CLI status event into store mutations.
 */
export function normalizeCliStatus(payload: CliStatusPayload): StoreMutation[] {
  const mutations: StoreMutation[] = [];
  const backend = payload.source === "cli-claude" ? "claude" : "codex";

  mutations.push({
    type: "createSession",
    sessionId: payload.sessionId,
    name: "CLI Session",
    backend: backend as "claude" | "codex",
  });

  mutations.push({
    type: "setWorking",
    sessionId: payload.sessionId,
    working: payload.status === "working",
  });

  return mutations;
}

/**
 * Normalize a CLI agent event into store mutations.
 */
export function normalizeCliEvent(
  payload: CliEventPayload,
  activePipelineRunId: string | null,
): StoreMutation[] {
  const mutations: StoreMutation[] = [];
  const sid = payload.sessionId;
  const evt = payload.event;
  const eventType = evt.event_type;
  const content = evt.content || "";
  const meta = evt.metadata;
  const backend = payload.source === "cli-claude" ? "claude" : payload.source === "cli-codex" ? "codex" : "sidecar";

  // Ensure session exists
  mutations.push({ type: "createSession", sessionId: sid, name: "CLI Session", backend: backend as "claude" | "codex" | "sidecar" });

  // Think without tool = assistant text
  if (eventType === "think" && !meta?.tool) {
    mutations.push({ type: "appendAssistant", sessionId: sid, text: content });
    return mutations;
  }

  // Tool use
  if (meta?.tool) {
    const agentEvent: AgentEvent = { timestamp: evt.timestamp, event_type: eventType as any, content, metadata: meta };
    mutations.push({ type: "addAgentEvent", sessionId: sid, event: agentEvent });
    mutations.push({ type: "upsertActivity", sessionId: sid, event: agentEvent });
    return mutations;
  }

  // Result
  if (eventType === "result") {
    mutations.push({ type: "setWorking", sessionId: sid, working: false });
    mutations.push({ type: "finalizeActivity", sessionId: sid });
    mutations.push({
      type: "insertCard",
      sessionId: sid,
      cardType: "outcome",
      content,
      data: {
        cost_usd: meta?.cost_usd,
        input_tokens: meta?.input_tokens,
        output_tokens: meta?.output_tokens,
        duration_ms: meta?.duration_ms,
      },
    });

    if (meta?.input_tokens || meta?.output_tokens) {
      mutations.push({
        type: "setApiMetrics",
        sessionId: sid,
        metrics: {
          inputTokens: (meta.input_tokens as number) || 0,
          outputTokens: (meta.output_tokens as number) || 0,
          cacheCreationInputTokens: (meta.cache_creation_input_tokens as number) || 0,
          cacheReadInputTokens: (meta.cache_read_input_tokens as number) || 0,
          cost: (meta.cost_usd as number) || 0,
          durationMs: (meta.duration_ms as number) || 0,
          durationApiMs: (meta.duration_api_ms as number) || 0,
        },
      });
    }

    const runId = activePipelineRunId;
    if (runId) {
      mutations.push({ type: "refreshPipelineRun", pipelineRunId: runId });
    }
    return mutations;
  }

  // Error
  if (eventType === "error") {
    mutations.push({ type: "setError", sessionId: sid, error: content });
    mutations.push({ type: "insertCard", sessionId: sid, cardType: "error", content, data: {} });
    return mutations;
  }

  // Phase transition
  if (eventType === "phase_transition") {
    const isGate = meta?.gate === "awaiting";
    mutations.push({
      type: "insertCard",
      sessionId: sid,
      cardType: isGate ? "gate-prompt" : "outcome",
      content,
      data: meta || {},
    });
    const runId = (meta?.pipeline_run_id as string) || activePipelineRunId;
    if (runId) {
      mutations.push({ type: "refreshPipelineRun", pipelineRunId: runId });
    }
    return mutations;
  }

  // Interaction request
  if (eventType === "interaction_request") {
    mutations.push({ type: "insertCard", sessionId: sid, cardType: "interaction", content, data: meta || {} });
    return mutations;
  }

  return mutations;
}
```

- [ ] **Step 2: Update useAgentStream to use normalizer**

In `src/hooks/useAgentStream.ts`, import the normalizer functions and use them inside the listener. The hook still handles applying mutations to the store, but the logic for *what* mutations to produce is now in the normalizer. This is a refactor — behavior should not change.

Read the current useAgentStream.ts and replace the CLI event handling blocks with calls to `normalizeCliStatus`/`normalizeCliEvent`, then apply the returned mutations to the store.

- [ ] **Step 3: Verify existing tests still pass**

Run: `npm run test:unit`
Expected: All 104 tests pass (refactor, no behavior change).

- [ ] **Step 4: Commit**

```bash
git add src/lib/agentStreamNormalizer.ts src/hooks/useAgentStream.ts
git commit -m "refactor: extract event normalization into testable pure functions"
```

### Task 4: Test agentStreamNormalizer

**Files:**
- Create: `src/lib/agentStreamNormalizer.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { normalizeCliStatus, normalizeCliEvent } from "./agentStreamNormalizer";
import type { CliEventPayload, CliStatusPayload } from "./agentStreamNormalizer";

// Import fixtures
import cliClaudeStatus from "../test-fixtures/events/cli-claude-status.json";
import cliClaudeThink from "../test-fixtures/events/cli-claude-think.json";
import cliClaudeResult from "../test-fixtures/events/cli-claude-result.json";
import cliCodexResult from "../test-fixtures/events/cli-codex-result.json";
import phaseTransitionGated from "../test-fixtures/events/phase-transition-gated.json";
import phaseTransitionAuto from "../test-fixtures/events/phase-transition-auto.json";
import interactionRequest from "../test-fixtures/events/interaction-request.json";
import cliClaudeTool from "../test-fixtures/events/cli-claude-tool.json";

describe("normalizeCliStatus", () => {
  it("creates session and sets working=true for 'working' status", () => {
    const mutations = normalizeCliStatus(cliClaudeStatus as CliStatusPayload);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "createSession", sessionId: "test-session-1", backend: "claude" }),
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "setWorking", sessionId: "test-session-1", working: true }),
    );
  });

  it("sets working=false for 'done' status", () => {
    const payload: CliStatusPayload = { type: "status", source: "cli-claude", sessionId: "s1", status: "done" };
    const mutations = normalizeCliStatus(payload);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "setWorking", working: false }),
    );
  });

  it("maps cli-codex source to codex backend", () => {
    const payload: CliStatusPayload = { type: "status", source: "cli-codex", sessionId: "s1", status: "working" };
    const mutations = normalizeCliStatus(payload);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "createSession", backend: "codex" }),
    );
  });
});

describe("normalizeCliEvent", () => {
  it("routes think event to appendAssistant", () => {
    const mutations = normalizeCliEvent(cliClaudeThink as CliEventPayload, null);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "appendAssistant", text: "Let me analyze that for you." }),
    );
  });

  it("routes tool event to addAgentEvent + upsertActivity", () => {
    const mutations = normalizeCliEvent(cliClaudeTool as CliEventPayload, null);
    expect(mutations.some((m) => m.type === "addAgentEvent")).toBe(true);
    expect(mutations.some((m) => m.type === "upsertActivity")).toBe(true);
  });

  it("routes result to outcome card + setWorking(false) + finalizeActivity", () => {
    const mutations = normalizeCliEvent(cliClaudeResult as CliEventPayload, null);
    expect(mutations).toContainEqual(expect.objectContaining({ type: "setWorking", working: false }));
    expect(mutations).toContainEqual(expect.objectContaining({ type: "finalizeActivity" }));
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "insertCard", cardType: "outcome" }),
    );
  });

  it("extracts API metrics from Claude result", () => {
    const mutations = normalizeCliEvent(cliClaudeResult as CliEventPayload, null);
    const metricsMut = mutations.find((m) => m.type === "setApiMetrics");
    expect(metricsMut).toBeDefined();
    if (metricsMut?.type === "setApiMetrics") {
      expect(metricsMut.metrics.inputTokens).toBe(1500);
      expect(metricsMut.metrics.outputTokens).toBe(200);
      expect(metricsMut.metrics.cost).toBe(0.025);
    }
  });

  it("extracts API metrics from Codex result (nulls for unavailable fields)", () => {
    const mutations = normalizeCliEvent(cliCodexResult as CliEventPayload, null);
    const metricsMut = mutations.find((m) => m.type === "setApiMetrics");
    expect(metricsMut).toBeDefined();
    if (metricsMut?.type === "setApiMetrics") {
      expect(metricsMut.metrics.inputTokens).toBe(10884);
      expect(metricsMut.metrics.cost).toBe(0); // null → 0
    }
  });

  it("refreshes pipeline run on result when active run exists", () => {
    const mutations = normalizeCliEvent(cliClaudeResult as CliEventPayload, "run-123");
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "refreshPipelineRun", pipelineRunId: "run-123" }),
    );
  });

  it("does NOT refresh pipeline run on result when no active run", () => {
    const mutations = normalizeCliEvent(cliClaudeResult as CliEventPayload, null);
    expect(mutations.some((m) => m.type === "refreshPipelineRun")).toBe(false);
  });

  it("routes gated phase_transition to gate-prompt card", () => {
    const mutations = normalizeCliEvent(phaseTransitionGated as CliEventPayload, null);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "insertCard", cardType: "gate-prompt" }),
    );
  });

  it("routes auto phase_transition to outcome card", () => {
    const mutations = normalizeCliEvent(phaseTransitionAuto as CliEventPayload, null);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "insertCard", cardType: "outcome" }),
    );
  });

  it("refreshes pipeline run on phase_transition using metadata run ID", () => {
    const mutations = normalizeCliEvent(phaseTransitionGated as CliEventPayload, null);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "refreshPipelineRun", pipelineRunId: "run-1" }),
    );
  });

  it("routes interaction_request to interaction card", () => {
    const mutations = normalizeCliEvent(interactionRequest as CliEventPayload, null);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: "insertCard", cardType: "interaction" }),
    );
    const cardMut = mutations.find((m) => m.type === "insertCard");
    if (cardMut?.type === "insertCard") {
      expect(cardMut.content).toBe("What technology stack would you like to use?");
    }
  });

  it("routes error event to error card + setError", () => {
    const payload: CliEventPayload = {
      type: "agent_event",
      source: "cli-claude",
      sessionId: "s1",
      event: { event_type: "error", content: "Something broke", timestamp: "2026-04-12T00:00:00Z" },
    };
    const mutations = normalizeCliEvent(payload, null);
    expect(mutations).toContainEqual(expect.objectContaining({ type: "setError", error: "Something broke" }));
    expect(mutations).toContainEqual(expect.objectContaining({ type: "insertCard", cardType: "error" }));
  });

  it("always includes createSession as first mutation", () => {
    const mutations = normalizeCliEvent(cliClaudeThink as CliEventPayload, null);
    expect(mutations[0].type).toBe("createSession");
  });
});
```

- [ ] **Step 2: Ensure JSON imports work**

You may need to add `"resolveJsonModule": true` to `tsconfig.json` if not already there. Check first.

- [ ] **Step 3: Run tests**

Run: `npm run test:unit`
Expected: All new + existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agentStreamNormalizer.test.ts
git commit -m "test: add event normalization tests with fixture-driven scenarios"
```

---

## Milestone C: Frontend Unit Tests — Store + Components

### Task 5: Test pipelineSlice

**Files:**
- Create: `src/stores/slices/pipelineSlice.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { create } from "zustand";
import { createPipelineSlice } from "./pipelineSlice";
import type { PipelineSlice } from "../types";

vi.mock("../../lib/tauri", () => ({
  commands: {
    listFrameworks: vi.fn().mockResolvedValue([
      { id: "superpowers", name: "Superpowers", supported_backends: ["claude"], supported_phases: ["ideation", "planning"], features: { visual_companion: true, interactive_questions: true }, phase_skills: {} },
      { id: "native", name: "Native", supported_backends: ["claude", "codex"], supported_phases: ["ideation", "planning", "execution"], features: { visual_companion: false, interactive_questions: false }, phase_skills: {} },
    ]),
    startPipeline: vi.fn().mockResolvedValue("run-1"),
    getPipelineRunStatus: vi.fn().mockResolvedValue({
      pipeline_run_id: "run-1",
      status: "running",
      current_phase: { phase_run_id: "pr-1", phase_id: "p-1", label: "Ideation", status: "running" },
      completed_phases: [],
    }),
    advanceGate: vi.fn().mockResolvedValue(undefined),
    getProjectPipeline: vi.fn().mockResolvedValue({ id: "pipeline-1", project_id: "proj-1", name: "Default" }),
    getPipelinePhases: vi.fn().mockResolvedValue([
      { id: "p-1", pipeline_id: "pipeline-1", position: 0, label: "Ideation", phase_type: "ideation", backend: "claude", framework: "superpowers", model: "opus", custom_prompt: null, gate_after: "gated" },
      { id: "p-2", pipeline_id: "pipeline-1", position: 1, label: "Execution", phase_type: "execution", backend: "codex", framework: "native", model: "gpt-4.1", custom_prompt: null, gate_after: "auto" },
    ]),
  },
}));

function createTestStore() {
  return create<PipelineSlice>()((...a) => createPipelineSlice(...(a as Parameters<typeof createPipelineSlice>)));
}

describe("pipelineSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe("builder", () => {
    it("adds a phase with defaults", () => {
      store.getState().addPhase("ideation", "Ideation");
      expect(store.getState().builderPhases).toHaveLength(1);
      expect(store.getState().builderPhases[0].backend).toBe("claude");
      expect(store.getState().builderPhases[0].framework).toBe("native");
      expect(store.getState().builderPhases[0].gateAfter).toBe("gated");
    });

    it("auto-selects newly added phase", () => {
      store.getState().addPhase("ideation", "Ideation");
      expect(store.getState().selectedPhaseId).toBe(store.getState().builderPhases[0].id);
    });

    it("removes a phase", () => {
      store.getState().addPhase("ideation", "Ideation");
      const id = store.getState().builderPhases[0].id;
      store.getState().removePhase(id);
      expect(store.getState().builderPhases).toHaveLength(0);
      expect(store.getState().selectedPhaseId).toBeNull();
    });

    it("reorders phases", () => {
      store.getState().addPhase("ideation", "Ideation");
      store.getState().addPhase("execution", "Execution");
      store.getState().reorderPhases(0, 1);
      expect(store.getState().builderPhases[0].phaseType).toBe("execution");
      expect(store.getState().builderPhases[1].phaseType).toBe("ideation");
    });

    it("toggles gate between gated and auto", () => {
      store.getState().addPhase("ideation", "Ideation");
      const id = store.getState().builderPhases[0].id;
      expect(store.getState().builderPhases[0].gateAfter).toBe("gated");
      store.getState().toggleGate(id);
      expect(store.getState().builderPhases[0].gateAfter).toBe("auto");
      store.getState().toggleGate(id);
      expect(store.getState().builderPhases[0].gateAfter).toBe("gated");
    });

    it("resets framework and model when backend changes", () => {
      store.getState().addPhase("ideation", "Ideation");
      const id = store.getState().builderPhases[0].id;
      store.getState().updatePhase(id, { framework: "superpowers", model: "opus" });
      store.getState().updatePhase(id, { backend: "codex" });
      expect(store.getState().builderPhases[0].framework).toBe("native");
      expect(store.getState().builderPhases[0].model).toBe("gpt-4.1");
    });

    it("resetBuilder clears all phases", () => {
      store.getState().addPhase("ideation", "Ideation");
      store.getState().addPhase("execution", "Execution");
      store.getState().resetBuilder();
      expect(store.getState().builderPhases).toHaveLength(0);
      expect(store.getState().selectedPhaseId).toBeNull();
    });
  });

  describe("framework loading", () => {
    it("loads frameworks from Tauri command", async () => {
      await store.getState().loadFrameworks();
      expect(store.getState().frameworks).toHaveLength(2);
      expect(store.getState().frameworks[0].id).toBe("superpowers");
    });
  });

  describe("pipeline hydration", () => {
    it("loads existing pipeline into builder state", async () => {
      await store.getState().loadProjectPipeline("proj-1");
      expect(store.getState().builderPhases).toHaveLength(2);
      expect(store.getState().builderPhases[0].label).toBe("Ideation");
      expect(store.getState().builderPhases[1].backend).toBe("codex");
    });

    it("clears builder when no pipeline exists", async () => {
      const { commands } = await import("../../lib/tauri");
      (commands.getProjectPipeline as any).mockResolvedValueOnce(null);
      store.getState().addPhase("ideation", "Ideation"); // pre-populate
      await store.getState().loadProjectPipeline("no-pipeline-proj");
      expect(store.getState().builderPhases).toHaveLength(0);
    });
  });

  describe("run tracking", () => {
    it("starts run and stores activePipelineRun", async () => {
      await store.getState().startPipelineRun("pipeline-1");
      const run = store.getState().activePipelineRun;
      expect(run).not.toBeNull();
      expect(run!.pipelineRunId).toBe("run-1");
      expect(run!.status).toBe("running");
      expect(run!.currentPhase?.label).toBe("Ideation");
    });

    it("clears run", async () => {
      await store.getState().startPipelineRun("pipeline-1");
      store.getState().clearPipelineRun();
      expect(store.getState().activePipelineRun).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test:unit`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/stores/slices/pipelineSlice.test.ts
git commit -m "test: add pipelineSlice tests for builder, hydration, and run tracking"
```

### Task 6: Test conversation components (PhaseIndicator, GatePromptCard, InteractionCard)

**Files:**
- Create: `src/components/conversation/PhaseIndicator.test.tsx`
- Create: `src/components/conversation/GatePromptCard.test.tsx`
- Create: `src/components/conversation/InteractionCard.test.tsx`

- [ ] **Step 1: Create PhaseIndicator.test.tsx**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PhaseIndicator } from "./PhaseIndicator";

const mockStore: Record<string, any> = {
  activePipelineRun: null,
  activeProjectId: null,
  startPipelineRun: vi.fn(),
};

vi.mock("../../stores", () => ({
  useAppStore: (selector: (s: any) => any) => selector(mockStore),
}));

vi.mock("../../lib/tauri", () => ({
  commands: {
    getProjectPipeline: vi.fn().mockResolvedValue({ id: "pipeline-1" }),
  },
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: any) => fn,
}));

describe("PhaseIndicator", () => {
  beforeEach(() => {
    mockStore.activePipelineRun = null;
    mockStore.activeProjectId = null;
  });

  it("renders nothing when no pipeline run and no project", () => {
    const { container } = render(<PhaseIndicator />);
    expect(container.innerHTML).toBe("");
  });

  it("shows Run Pipeline button when project has pipeline but no run", () => {
    mockStore.activeProjectId = "proj-1";
    render(<PhaseIndicator />);
    // The button appears after an async check, so this validates the initial render
  });

  it("shows phase progress when run is active", () => {
    mockStore.activePipelineRun = {
      pipelineRunId: "run-1",
      status: "running",
      currentPhase: { phaseRunId: "pr-1", phaseId: "p-1", label: "Planning", status: "running" },
      completedPhases: [
        { phaseRunId: "pr-0", phaseId: "p-0", label: "Ideation", status: "completed", artifactPath: null, summary: null },
      ],
    };
    render(<PhaseIndicator />);
    expect(screen.getByText("Ideation")).toBeDefined();
    expect(screen.getByText("Planning")).toBeDefined();
    expect(screen.getByText("running")).toBeDefined();
  });

  it("shows awaiting_gate status for gated phase", () => {
    mockStore.activePipelineRun = {
      pipelineRunId: "run-1",
      status: "running",
      currentPhase: { phaseRunId: "pr-1", phaseId: "p-1", label: "Review", status: "awaiting_gate" },
      completedPhases: [],
    };
    render(<PhaseIndicator />);
    expect(screen.getByTitle("Review: awaiting_gate")).toBeDefined();
  });
});
```

- [ ] **Step 2: Create GatePromptCard.test.tsx**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GatePromptCard } from "./GatePromptCard";
import type { ChatMessage } from "../../stores/types";

const mockAdvance = vi.fn();
vi.mock("../../stores", () => ({
  useAppStore: (selector: (s: any) => any) =>
    selector({
      activePipelineRun: { pipelineRunId: "run-1" },
      advancePipelineGate: mockAdvance,
    }),
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: any) => fn,
}));

describe("GatePromptCard", () => {
  const gateMessage: ChatMessage = {
    id: "msg-1",
    role: "system",
    content: "Phase 'Planning' complete. Review and continue.",
    timestamp: "2026-04-12T00:00:00Z",
    cardType: "gate-prompt",
    cardData: { gate: "awaiting", next_phase_id: "p-3" },
  };

  it("renders gate message content", () => {
    render(<GatePromptCard message={gateMessage} />);
    expect(screen.getByText(/Planning.*complete/)).toBeDefined();
  });

  it("shows continue button when gate is awaiting", () => {
    render(<GatePromptCard message={gateMessage} />);
    expect(screen.getByText("Continue to next phase")).toBeDefined();
  });

  it("calls advancePipelineGate on continue click", () => {
    render(<GatePromptCard message={gateMessage} />);
    fireEvent.click(screen.getByText("Continue to next phase"));
    expect(mockAdvance).toHaveBeenCalledWith("run-1");
  });
});
```

- [ ] **Step 3: Create InteractionCard.test.tsx**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InteractionCard } from "./InteractionCard";
import type { ChatMessage } from "../../stores/types";

describe("InteractionCard", () => {
  const choiceMessage: ChatMessage = {
    id: "msg-1",
    role: "system",
    content: "What stack?",
    timestamp: "2026-04-12T00:00:00Z",
    cardType: "interaction",
    cardData: { options: ["React", "Vue", "Svelte"], inputType: "choice" },
  };

  const textMessage: ChatMessage = {
    id: "msg-2",
    role: "system",
    content: "Describe your project.",
    timestamp: "2026-04-12T00:00:00Z",
    cardType: "interaction",
    cardData: { inputType: "text" },
  };

  const answeredMessage: ChatMessage = {
    id: "msg-3",
    role: "system",
    content: "What stack?",
    timestamp: "2026-04-12T00:00:00Z",
    cardType: "interaction",
    cardData: { options: ["React"], inputType: "choice", answered: true },
  };

  it("renders choice options", () => {
    render(<InteractionCard message={choiceMessage} />);
    expect(screen.getByText("React")).toBeDefined();
    expect(screen.getByText("Vue")).toBeDefined();
    expect(screen.getByText("Svelte")).toBeDefined();
  });

  it("calls onRespond when choice is clicked", () => {
    const onRespond = vi.fn();
    render(<InteractionCard message={choiceMessage} onRespond={onRespond} />);
    fireEvent.click(screen.getByText("React"));
    expect(onRespond).toHaveBeenCalledWith("React");
  });

  it("renders text input when inputType is text", () => {
    render(<InteractionCard message={textMessage} />);
    expect(screen.getByPlaceholderText("Type your answer...")).toBeDefined();
  });

  it("shows Answered state when answered=true", () => {
    render(<InteractionCard message={answeredMessage} />);
    expect(screen.getByText("Answered")).toBeDefined();
  });
});
```

- [ ] **Step 4: Run all tests**

Run: `npm run test:unit`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/conversation/PhaseIndicator.test.tsx src/components/conversation/GatePromptCard.test.tsx src/components/conversation/InteractionCard.test.tsx
git commit -m "test: add PhaseIndicator, GatePromptCard, InteractionCard component tests"
```

---

## Milestone D: Rust — Fake Backend + Integration Tests

### Task 7: Add Rust dev-dependencies and test feature flag

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add dev-dependencies and feature**

Add to `src-tauri/Cargo.toml`:

```toml
[dev-dependencies]
tempfile = "3"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
test-fake = []
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "chore: add tempfile dev-dep and test-fake feature flag"
```

### Task 8: Create FakeAdapter + injectable adapter dispatch seam

**Files:**
- Create: `src-tauri/src/backends/fake.rs`
- Modify: `src-tauri/src/backends/mod.rs`
- Modify: `src-tauri/src/workflow/runner.rs`

The FakeAdapter emits `"source": "cli-claude"` (not `"cli-fake"`) so it matches the existing frontend contract. The adapter dispatch in WorkflowRunner is made injectable so tests can override it.

- [ ] **Step 1: Create fake.rs**

Create `src-tauri/src/backends/fake.rs`. Key design points:
- `FakeAdapter::new(scenario)` accepts a `FakeScenario` (list of scripted events)
- `spawn()` emits events on a background thread with `"source": "cli-claude"` to match the existing frontend listener contract
- `validate()` returns success immediately
- `send_input()` and `cancel()` are no-ops (return Ok)
- The adapter name is `"fake"` but the emitted envelope source is configurable (defaults to `"cli-claude"`)

```rust
use std::thread;
use std::time::Duration;
use serde::Deserialize;
use tauri::{AppHandle, Emitter};
use super::{BackendAdapter, SpawnArgs, CliInfo, ModelInfo};

#[derive(Debug, Deserialize, Clone)]
pub struct FakeScenario {
    pub events: Vec<FakeEvent>,
    #[serde(default = "default_source")]
    pub source: String, // "cli-claude" or "cli-codex" — what the frontend expects
}

fn default_source() -> String { "cli-claude".to_string() }

#[derive(Debug, Deserialize, Clone)]
pub struct FakeEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub status: Option<String>,
    pub event: Option<FakeAgentEvent>,
    pub delay_ms: Option<u64>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct FakeAgentEvent {
    pub event_type: String,
    pub content: String,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

pub struct FakeAdapter { scenario: FakeScenario }

impl FakeAdapter {
    pub fn new(scenario: FakeScenario) -> Self { Self { scenario } }
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str::<FakeScenario>(json)
            .map(Self::new)
            .map_err(|e| format!("Invalid scenario: {}", e))
    }
}

impl BackendAdapter for FakeAdapter {
    fn name(&self) -> &str { "fake" }
    fn validate(&self) -> Result<CliInfo, String> {
        Ok(CliInfo { name: "fake".into(), version: "1.0.0-test".into() })
    }
    fn spawn(&self, args: SpawnArgs, app: &AppHandle) -> Result<String, String> {
        let sid = args.session_id.clone();
        let events = self.scenario.events.clone();
        let source = self.scenario.source.clone();
        let app_handle = app.clone();
        let sid_clone = sid.clone();
        thread::spawn(move || {
            for event in events {
                if let Some(delay) = event.delay_ms { thread::sleep(Duration::from_millis(delay)); }
                match event.event_type.as_str() {
                    "status" => {
                        let _ = app_handle.emit("agent-stream", serde_json::json!({
                            "type": "status", "source": &source, "sessionId": &sid_clone,
                            "status": event.status.as_deref().unwrap_or("working"),
                        }));
                    }
                    "agent_event" => {
                        if let Some(evt) = event.event {
                            let _ = app_handle.emit("agent-stream", serde_json::json!({
                                "type": "agent_event", "source": &source, "sessionId": &sid_clone,
                                "event": { "event_type": evt.event_type, "content": evt.content,
                                           "metadata": evt.metadata, "timestamp": chrono::Utc::now().to_rfc3339() }
                            }));
                        }
                    }
                    _ => {}
                }
            }
        });
        Ok(sid)
    }
    fn send_input(&self, _: &str, _: &str, _: &AppHandle) -> Result<(), String> { Ok(()) }
    fn cancel(&self, _: &str, _: &AppHandle) -> Result<(), String> { Ok(()) }
    fn supported_models(&self) -> Vec<ModelInfo> {
        vec![ModelInfo { id: "fake".into(), name: "Fake".into(), backend: "fake".into() }]
    }
}
```

- [ ] **Step 2: Register in mod.rs**

Add to `src-tauri/src/backends/mod.rs`:

```rust
#[cfg(any(test, feature = "test-fake"))]
pub mod fake;
```

- [ ] **Step 3: Refactor WorkflowRunner into engine + Tauri layer**

The core design decision: **extract a `WorkflowEngine` that takes `&Connection` + an adapter factory closure**, separate from the Tauri-coupled `WorkflowRunner`. This is the test seam.

In `src-tauri/src/workflow/runner.rs`:

**Add `WorkflowEngine`** — a struct that holds `&Connection` and an adapter factory:

```rust
type AdapterFactory = Box<dyn Fn(&str) -> Result<Box<dyn BackendAdapter>, String> + Send + Sync>;

/// Testable core engine. No Tauri dependency — takes &Connection directly.
pub struct WorkflowEngine<'a> {
    conn: &'a Connection,
    adapter_factory: AdapterFactory,
    app: Option<&'a AppHandle>,  // None in tests, Some in production
}

impl<'a> WorkflowEngine<'a> {
    /// Production constructor — uses real adapters.
    pub fn new(conn: &'a Connection, app: &'a AppHandle) -> Self {
        Self {
            conn,
            adapter_factory: Box::new(|backend| match backend {
                "claude" => Ok(Box::new(ClaudeAdapter) as Box<dyn BackendAdapter>),
                "codex" => Ok(Box::new(CodexAdapter) as Box<dyn BackendAdapter>),
                other => Err(format!("Unknown backend: {}", other)),
            }),
            app: Some(app),
        }
    }

    /// Test constructor — injectable adapter factory, no AppHandle needed for DB-only operations.
    #[cfg(any(test, feature = "test-fake"))]
    pub fn for_test(conn: &'a Connection, factory: AdapterFactory) -> Self {
        Self { conn, adapter_factory: factory, app: None }
    }
}
```

Move ALL the method bodies from `WorkflowRunner` into `WorkflowEngine`, replacing `self.app.state::<Mutex<Connection>>()` with `self.conn`. The adapter dispatch in `start_phase` calls `(self.adapter_factory)(backend)`.

**Keep `WorkflowRunner`** as a thin Tauri layer:

```rust
pub struct WorkflowRunner { app: AppHandle }

impl WorkflowRunner {
    pub fn new(app: AppHandle) -> Self { Self { app } }

    pub async fn start_pipeline(&self, pipeline_id: &str) -> Result<String, String> {
        let db = self.app.state::<Mutex<Connection>>();
        let conn = db.lock().map_err(|e| format!("DB lock: {}", e))?;
        let engine = WorkflowEngine::new(&conn, &self.app);
        engine.start_pipeline(pipeline_id)
    }
    // ... same pattern for other methods
}
```

This means:
- Production path unchanged (WorkflowRunner → WorkflowEngine with real adapters)
- Tests construct `WorkflowEngine::for_test(&conn, factory)` with a FakeAdapter factory and an in-memory DB
- No AppHandle needed for DB-only test scenarios (start_pipeline, on_phase_complete, advance_gate, get_run_status all work against the DB)
- Adapter spawn is skipped in tests where `app` is None (the engine can early-return or no-op for the spawn call in test mode)

- [ ] **Step 4: Verify with test feature**

Run: `cargo check -p vibe-os --features test-fake`
Expected: Compiles including fake.rs.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/backends/fake.rs src-tauri/src/backends/mod.rs src-tauri/src/workflow/runner.rs
git commit -m "feat: add FakeAdapter + injectable adapter dispatch for testing"
```

### Task 9: Create Rust workflow fixture files

**Files:**
- Create: `src-tauri/test-fixtures/workflows/single-phase-success.json`
- Create: `src-tauri/test-fixtures/workflows/gated-three-phase.json`

- [ ] **Step 1: Create fixture files**

**`src-tauri/test-fixtures/workflows/single-phase-success.json`:**
```json
{
  "events": [
    { "type": "status", "status": "working" },
    { "type": "agent_event", "event": { "event_type": "think", "content": "Analyzing the codebase..." } },
    { "type": "agent_event", "event": { "event_type": "result", "content": "Analysis complete.", "metadata": { "input_tokens": 100, "output_tokens": 50 } } },
    { "type": "status", "status": "done" }
  ]
}
```

**`src-tauri/test-fixtures/workflows/gated-three-phase.json`:**
```json
{
  "events": [
    { "type": "status", "status": "working" },
    { "type": "agent_event", "event": { "event_type": "think", "content": "Working on phase..." } },
    { "type": "agent_event", "event": { "event_type": "result", "content": "Phase complete.", "metadata": { "input_tokens": 200, "output_tokens": 100 } } },
    { "type": "status", "status": "done" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/test-fixtures/
git commit -m "chore: add Rust workflow fixture files for integration tests"
```

### Task 10: Extract inner command functions + create test helpers

**Files:**
- Modify: `src-tauri/src/db.rs` — make `run_migrations` pub(crate)
- Modify: `src-tauri/src/commands/project_commands.rs` — extract `create_project_db`, `delete_project_db` inner functions
- Modify: `src-tauri/src/commands/pipeline_commands.rs` — extract `create_pipeline_db`, `get_pipeline_phases_db`, `delete_pipeline_db` inner functions
- Create: `src-tauri/tests/test_helpers.rs`

The Tauri `#[tauri::command]` functions use `State<'_>` which isn't constructable in tests. Extract the core logic into plain functions that take `&Connection`, which the commands call and tests also call.

- [ ] **Step 1: Make run_migrations accessible**

In `src-tauri/src/db.rs`, change `fn run_migrations` to `pub(crate) fn run_migrations`.

- [ ] **Step 2: Extract inner functions from project_commands.rs**

In `src-tauri/src/commands/project_commands.rs`, extract the SQL logic:

```rust
/// Inner function callable from tests (no State<'_> dependency).
pub fn create_project_db(conn: &Connection, name: &str, workspace_path: &str, summary: Option<&str>) -> Result<ProjectRow, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let summary_val = summary.unwrap_or("");
    conn.execute(
        "INSERT INTO projects (id, name, workspace_path, summary, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        rusqlite::params![id, name, workspace_path, summary_val, now],
    ).map_err(|e| format!("Insert failed: {}", e))?;
    Ok(ProjectRow { id, name: name.to_string(), workspace_path: workspace_path.to_string(), summary: summary_val.to_string(), created_at: now.clone(), updated_at: now })
}

pub fn delete_project_db(conn: &Connection, id: &str) -> Result<(), String> {
    // Same cascade logic as the existing delete_project command
    conn.execute("DELETE FROM phase_run WHERE pipeline_run_id IN (SELECT id FROM pipeline_run WHERE pipeline_id IN (SELECT id FROM pipeline WHERE project_id = ?1))", [id]).map_err(|e| format!("{}", e))?;
    conn.execute("DELETE FROM pipeline_run WHERE pipeline_id IN (SELECT id FROM pipeline WHERE project_id = ?1)", [id]).map_err(|e| format!("{}", e))?;
    conn.execute("DELETE FROM pipeline_phase WHERE pipeline_id IN (SELECT id FROM pipeline WHERE project_id = ?1)", [id]).map_err(|e| format!("{}", e))?;
    conn.execute("DELETE FROM pipeline WHERE project_id = ?1", [id]).map_err(|e| format!("{}", e))?;
    conn.execute("DELETE FROM projects WHERE id = ?1", [id]).map_err(|e| format!("{}", e))?;
    Ok(())
}

// The #[tauri::command] functions become thin wrappers:
#[tauri::command]
pub fn create_project(state: State<'_, DbState>, name: String, workspace_path: String) -> Result<ProjectRow, String> {
    let conn = state.lock().map_err(|e| format!("DB lock: {}", e))?;
    create_project_db(&conn, &name, &workspace_path, None)
}
```

Do the same for `delete_project`. The key is that the inner `_db` functions are `pub` and take `&Connection`.

- [ ] **Step 3: Extract inner functions from pipeline_commands.rs**

Same pattern: extract `create_pipeline_db(conn, project_id, name, phases)`, `get_pipeline_phases_db(conn, pipeline_id)`, `delete_pipeline_db(conn, pipeline_id)`.

- [ ] **Step 4: Create test_helpers.rs**

```rust
//! Shared test utilities for Rust integration tests.
//! Uses REAL migration code from db.rs, not hand-copied SQL.

use rusqlite::Connection;

/// Create an in-memory SQLite DB with all real migrations applied.
pub fn create_test_db() -> Connection {
    let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
    conn.execute_batch("PRAGMA foreign_keys=ON;").expect("PRAGMAs failed");
    // Use the real migration function from the app
    app_lib::db::run_migrations(&conn).expect("Migrations failed");
    conn
}

/// Insert a test project using real SQL (matches project_commands.rs pattern).
pub fn insert_test_project(conn: &Connection, name: &str) -> String {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        "INSERT INTO projects (id, name, workspace_path, summary, created_at, updated_at) VALUES (?1, ?2, '/tmp/test', '', ?3, ?3)",
        rusqlite::params![id, name, now],
    ).expect("Insert project failed");
    id
}

/// Insert a test pipeline with phases. Returns (pipeline_id, Vec<phase_id>).
pub fn insert_test_pipeline(
    conn: &Connection,
    project_id: &str,
    phases: &[(&str, &str, &str, &str, &str, &str)], // (label, phase_type, backend, framework, model, gate_after)
) -> (String, Vec<String>) {
    let pipeline_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        "INSERT INTO pipeline (id, project_id, name, created_at, updated_at) VALUES (?1, ?2, 'Test', ?3, ?3)",
        rusqlite::params![pipeline_id, project_id, now],
    ).expect("Insert pipeline failed");

    let mut phase_ids = Vec::new();
    for (i, (label, phase_type, backend, framework, model, gate_after)) in phases.iter().enumerate() {
        let phase_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO pipeline_phase (id, pipeline_id, position, label, phase_type, backend, framework, model, gate_after)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![phase_id, pipeline_id, i as i32, label, phase_type, backend, framework, model, gate_after],
        ).expect("Insert phase failed");
        phase_ids.push(phase_id);
    }

    (pipeline_id, phase_ids)
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db.rs src-tauri/tests/test_helpers.rs
git commit -m "chore: add Rust test helpers using real migration code"
```

### Task 10.5: Pipeline persistence integration tests (calling REAL command functions)

**Files:**
- Create: `src-tauri/tests/pipeline_persistence_integration.rs`

These tests call the **real** extracted `_db` inner functions from `project_commands` and `pipeline_commands`, not ad hoc SQL. This validates actual command behavior including edge cases in the real code.

- [ ] **Step 1: Create pipeline_persistence_integration.rs**

```rust
mod test_helpers;
use test_helpers::*;
use app_lib::commands::project_commands::{create_project_db, delete_project_db};
use app_lib::commands::pipeline_commands::{create_pipeline_db, get_pipeline_phases_db, delete_pipeline_db, CreatePhaseArgs};

#[test]
fn test_create_pipeline_with_ordered_phases() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "test-project", "/tmp/test", None).unwrap();

    let pipeline = create_pipeline_db(
        &conn,
        &project.id,
        "Test Pipeline",
        &[
            CreatePhaseArgs { label: "Ideation".into(), phase_type: "ideation".into(), backend: "claude".into(), framework: "superpowers".into(), model: "opus".into(), custom_prompt: None, gate_after: "gated".into() },
            CreatePhaseArgs { label: "Planning".into(), phase_type: "planning".into(), backend: "codex".into(), framework: "native".into(), model: "gpt-4.1".into(), custom_prompt: None, gate_after: "auto".into() },
            CreatePhaseArgs { label: "Execution".into(), phase_type: "execution".into(), backend: "claude".into(), framework: "gsd".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "gated".into() },
        ],
    ).unwrap();

    let phases = get_pipeline_phases_db(&conn, &pipeline.id).unwrap();
    assert_eq!(phases.len(), 3);
    assert_eq!(phases[0].label, "Ideation");
    assert_eq!(phases[0].position, 0);
    assert_eq!(phases[0].backend, "claude");
    assert_eq!(phases[1].label, "Planning");
    assert_eq!(phases[1].backend, "codex");
    assert_eq!(phases[2].label, "Execution");
    assert_eq!(phases[2].position, 2);
}

#[test]
fn test_delete_project_cascades_via_real_command() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "cascade-test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(
        &conn,
        &project.id,
        "Test",
        &[CreatePhaseArgs { label: "Phase 1".into(), phase_type: "ideation".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "auto".into() }],
    ).unwrap();

    // Add run data (this part uses direct SQL since run creation goes through the runner)
    let phases = get_pipeline_phases_db(&conn, &pipeline.id).unwrap();
    let run_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO pipeline_run (id, pipeline_id, status, started_at) VALUES (?1, ?2, 'completed', '2026-04-12T00:00:00Z')",
        rusqlite::params![run_id, pipeline.id],
    ).unwrap();
    conn.execute(
        "INSERT INTO phase_run (id, pipeline_run_id, phase_id, session_id, status, started_at) VALUES (?1, ?2, ?3, 'sess-1', 'completed', '2026-04-12T00:00:00Z')",
        rusqlite::params![uuid::Uuid::new_v4().to_string(), run_id, phases[0].id],
    ).unwrap();

    // Call real delete_project_db — should cascade everything
    delete_project_db(&conn, &project.id).unwrap();

    // Verify complete cleanup
    for table in &["projects", "pipeline", "pipeline_phase", "pipeline_run", "phase_run"] {
        let count: i32 = conn.query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0, "Table {} should be empty after cascade delete", table);
    }
}

#[test]
fn test_update_phases_replaces_all() {
    use app_lib::commands::pipeline_commands::update_pipeline_phases_db;

    let conn = create_test_db();
    let project = create_project_db(&conn, "replace-test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(
        &conn,
        &project.id,
        "Test",
        &[
            CreatePhaseArgs { label: "Old Phase 1".into(), phase_type: "ideation".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "auto".into() },
            CreatePhaseArgs { label: "Old Phase 2".into(), phase_type: "execution".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "auto".into() },
        ],
    ).unwrap();

    // Call real update function
    update_pipeline_phases_db(
        &conn,
        &pipeline.id,
        &[CreatePhaseArgs { label: "New Single Phase".into(), phase_type: "verification".into(), backend: "codex".into(), framework: "native".into(), model: "gpt-4.1".into(), custom_prompt: None, gate_after: "gated".into() }],
    ).unwrap();

    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM pipeline_phase WHERE pipeline_id = ?1", [&pipeline_id], |r| r.get(0),
    ).unwrap();
    assert_eq!(count, 1);

    let label: String = conn.query_row(
        "SELECT label FROM pipeline_phase WHERE pipeline_id = ?1", [&pipeline_id], |r| r.get(0),
    ).unwrap();
    assert_eq!(label, "New Single Phase");
}
```

- [ ] **Step 2: Run tests**

Run: `cd src-tauri && cargo test --test pipeline_persistence_integration`
Expected: All 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tests/pipeline_persistence_integration.rs
git commit -m "test: add pipeline persistence integration tests using real command patterns"
```

### Task 10.75: Workflow runner integration tests (PRIMARY RUST DELIVERABLE)

**Files:**
- Create: `src-tauri/tests/workflow_runner_integration.rs`

This is the highest-value Rust test in Phase A. It tests the real `WorkflowEngine` methods (`start_pipeline`, `on_phase_complete`, `advance_gate`, `get_run_status`) against a temp SQLite DB with an injected FakeAdapter factory.

**Test seam (decided in Task 8):** Task 8 extracted `WorkflowEngine` from `WorkflowRunner`. The engine takes `&Connection` directly (no `AppHandle`) and an `adapter_factory` closure. Tests use `WorkflowEngine::for_test(&conn, factory)` where the factory returns a `FakeAdapter` for any backend name. The FakeAdapter's `spawn()` is a no-op in these tests (we're testing DB state transitions, not event emission).

- [ ] **Step 1: Create workflow_runner_integration.rs**

```rust
mod test_helpers;
use test_helpers::*;
use app_lib::workflow::runner::{WorkflowEngine, PipelineRunStatus};
use app_lib::commands::project_commands::create_project_db;
use app_lib::commands::pipeline_commands::{create_pipeline_db, CreatePhaseArgs};
use app_lib::backends::fake::{FakeAdapter, FakeScenario};
use app_lib::backends::BackendAdapter;

fn noop_factory() -> Box<dyn Fn(&str) -> Result<Box<dyn BackendAdapter>, String> + Send + Sync> {
    Box::new(|_backend| {
        // FakeAdapter with empty events — spawn is a no-op
        Ok(Box::new(FakeAdapter::new(FakeScenario { events: vec![], source: "cli-claude".into() })))
    })
}

#[test]
fn test_start_pipeline_creates_run_and_first_phase() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(&conn, &project.id, "Test", &[
        CreatePhaseArgs { label: "Ideation".into(), phase_type: "ideation".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "auto".into() },
        CreatePhaseArgs { label: "Execution".into(), phase_type: "execution".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "gated".into() },
    ]).unwrap();

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline.id).unwrap();

    // Verify pipeline_run created
    let status: String = conn.query_row("SELECT status FROM pipeline_run WHERE id = ?1", [&run_id], |r| r.get(0)).unwrap();
    assert_eq!(status, "running");

    // Verify first phase_run created
    let phase_status: String = conn.query_row(
        "SELECT status FROM phase_run WHERE pipeline_run_id = ?1", [&run_id], |r| r.get(0),
    ).unwrap();
    assert_eq!(phase_status, "running");
}

#[test]
fn test_on_phase_complete_auto_advances() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(&conn, &project.id, "Test", &[
        CreatePhaseArgs { label: "Phase 1".into(), phase_type: "ideation".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "auto".into() },
        CreatePhaseArgs { label: "Phase 2".into(), phase_type: "execution".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "auto".into() },
    ]).unwrap();

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline.id).unwrap();

    // Find the running phase_run
    let (phase_run_id,): (String,) = conn.query_row(
        "SELECT id FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
        [&run_id], |r| Ok((r.get(0)?,)),
    ).unwrap();

    // Complete it
    engine.on_phase_complete(&run_id, &phase_run_id).unwrap();

    // Phase 1 should be completed
    let p1_status: String = conn.query_row("SELECT status FROM phase_run WHERE id = ?1", [&phase_run_id], |r| r.get(0)).unwrap();
    assert_eq!(p1_status, "completed");

    // Phase 2 should be running (auto-advanced)
    let p2_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
        [&run_id], |r| r.get(0),
    ).unwrap();
    assert_eq!(p2_count, 1);
}

#[test]
fn test_on_phase_complete_gated_stops() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(&conn, &project.id, "Test", &[
        CreatePhaseArgs { label: "Phase 1".into(), phase_type: "ideation".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "gated".into() },
        CreatePhaseArgs { label: "Phase 2".into(), phase_type: "execution".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "auto".into() },
    ]).unwrap();

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline.id).unwrap();

    let (phase_run_id,): (String,) = conn.query_row(
        "SELECT id FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
        [&run_id], |r| Ok((r.get(0)?,)),
    ).unwrap();

    engine.on_phase_complete(&run_id, &phase_run_id).unwrap();

    // Phase 1 should be awaiting_gate
    let p1_status: String = conn.query_row("SELECT status FROM phase_run WHERE id = ?1", [&phase_run_id], |r| r.get(0)).unwrap();
    assert_eq!(p1_status, "awaiting_gate");

    // No Phase 2 running yet
    let running: i32 = conn.query_row(
        "SELECT COUNT(*) FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
        [&run_id], |r| r.get(0),
    ).unwrap();
    assert_eq!(running, 0);
}

#[test]
fn test_advance_gate_starts_next_phase() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(&conn, &project.id, "Test", &[
        CreatePhaseArgs { label: "Phase 1".into(), phase_type: "ideation".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "gated".into() },
        CreatePhaseArgs { label: "Phase 2".into(), phase_type: "execution".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "auto".into() },
    ]).unwrap();

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline.id).unwrap();

    let (pr_id,): (String,) = conn.query_row(
        "SELECT id FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
        [&run_id], |r| Ok((r.get(0)?,)),
    ).unwrap();

    // Complete → awaiting_gate
    engine.on_phase_complete(&run_id, &pr_id).unwrap();

    // Advance gate
    engine.advance_gate(&run_id).unwrap();

    // Phase 2 should now be running
    let running_label: String = conn.query_row(
        "SELECT pp.label FROM phase_run pr JOIN pipeline_phase pp ON pr.phase_id = pp.id WHERE pr.pipeline_run_id = ?1 AND pr.status = 'running'",
        [&run_id], |r| r.get(0),
    ).unwrap();
    assert_eq!(running_label, "Phase 2");
}

#[test]
fn test_final_phase_completes_pipeline() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(&conn, &project.id, "Test", &[
        CreatePhaseArgs { label: "Only Phase".into(), phase_type: "execution".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "auto".into() },
    ]).unwrap();

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline.id).unwrap();

    let (pr_id,): (String,) = conn.query_row(
        "SELECT id FROM phase_run WHERE pipeline_run_id = ?1 AND status = 'running'",
        [&run_id], |r| Ok((r.get(0)?,)),
    ).unwrap();

    engine.on_phase_complete(&run_id, &pr_id).unwrap();

    let run_status: String = conn.query_row("SELECT status FROM pipeline_run WHERE id = ?1", [&run_id], |r| r.get(0)).unwrap();
    assert_eq!(run_status, "completed");
}

#[test]
fn test_get_run_status_returns_phases() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(&conn, &project.id, "Test", &[
        CreatePhaseArgs { label: "Phase 1".into(), phase_type: "ideation".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "auto".into() },
        CreatePhaseArgs { label: "Phase 2".into(), phase_type: "execution".into(), backend: "claude".into(), framework: "native".into(), model: "sonnet".into(), custom_prompt: None, gate_after: "auto".into() },
    ]).unwrap();

    let engine = WorkflowEngine::for_test(&conn, noop_factory());
    let run_id = engine.start_pipeline(&pipeline.id).unwrap();

    let status = engine.get_run_status(&run_id).unwrap();
    assert_eq!(status.status, "running");
    assert!(status.current_phase.is_some());
    assert_eq!(status.current_phase.unwrap().label, "Phase 1");
}

#[test]
fn test_unknown_backend_fails_phase() {
    let conn = create_test_db();
    let project = create_project_db(&conn, "test", "/tmp/test", None).unwrap();
    let pipeline = create_pipeline_db(&conn, &project.id, "Test", &[
        CreatePhaseArgs { label: "Bad Phase".into(), phase_type: "ideation".into(), backend: "nonexistent".into(), framework: "native".into(), model: "x".into(), custom_prompt: None, gate_after: "auto".into() },
    ]).unwrap();

    // Factory that rejects unknown backends
    let strict_factory: Box<dyn Fn(&str) -> Result<Box<dyn BackendAdapter>, String> + Send + Sync> =
        Box::new(|backend| Err(format!("Unknown backend: {}", backend)));

    let engine = WorkflowEngine::for_test(&conn, strict_factory);
    let run_id = engine.start_pipeline(&pipeline.id).unwrap();

    // Phase should be marked failed
    let phase_status: String = conn.query_row(
        "SELECT status FROM phase_run WHERE pipeline_run_id = ?1",
        [&run_id], |r| r.get(0),
    ).unwrap();
    assert_eq!(phase_status, "failed");
}
```

- [ ] **Step 2: Run tests**

Run: `cd src-tauri && cargo test --test workflow_runner_integration`
Expected: All 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tests/workflow_runner_integration.rs
git commit -m "test: add workflow runner integration tests for pipeline progression and gating"
```

---

## Milestone E: Docs + Verification

### Task 11: Create manual smoke checklist

**Files:**
- Create: `docs/testing/manual-workflow-smoke-checklist.md`

- [ ] **Step 1: Create checklist**

```markdown
# Manual Workflow Smoke Checklist

Run before shipping major workflow changes.

## Project Lifecycle
- [ ] Create a new project from scratch
- [ ] Create a pipeline with 3+ phases (mix Claude and Codex backends)
- [ ] Verify pipeline persists (check PhaseIndicator or builder shows phases)
- [ ] Delete project and confirm cleanup (no orphaned pipelines)

## Pipeline Execution
- [ ] Run pipeline via PhaseIndicator "Run Pipeline" button
- [ ] Verify phase indicator shows running state
- [ ] Gate continue works (GatePromptCard "Continue" button)
- [ ] Pipeline completes all phases

## Interaction
- [ ] Interaction question card renders in chat
- [ ] User can answer via choice or text input
- [ ] Answer routes to backend

## Session Persistence
- [ ] Reopen project after navigating away
- [ ] Reopen project after app restart
- [ ] Session state is coherent (no empty/broken session)

## Real CLI
- [ ] Run one real Claude session (requires Claude CLI)
- [ ] Run one real Codex session (requires Codex CLI)
- [ ] Cancel an in-progress session

## Error Handling
- [ ] Backend error shows error card (not crash)
- [ ] No duplicate cards/messages after error
- [ ] Verify errors are visible and recoverable
```

- [ ] **Step 2: Commit**

```bash
git add docs/testing/manual-workflow-smoke-checklist.md
git commit -m "docs: add manual workflow smoke checklist"
```

### Task 12: Full verification run

- [ ] **Step 1: Run all frontend tests**

Run: `npm run test:unit`
Expected: All tests pass (existing 104 + new ~35 = ~139 total).

- [ ] **Step 2: Run Rust unit tests**

Run: `npm run test:rust`
Expected: All 72+ tests pass.

- [ ] **Step 3: Run Rust integration tests**

Run: `cd src-tauri && cargo test --tests`
Expected: All pipeline persistence + workflow runner integration tests pass.

- [ ] **Step 4: Verify fake adapter compiles**

Run: `cd src-tauri && cargo check --features test-fake`
Expected: Compiles including fake.rs.

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run full build**

Run: `npm run build`
Expected: Builds successfully.
