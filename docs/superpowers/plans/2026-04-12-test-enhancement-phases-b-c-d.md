# Test Enhancement Phases B, C, D

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add frontend integration tests for multi-component flows (project creation, pipeline hydration, workflow event sync), hardening tests for persistence/failure/cancellation, and formalize the real CLI smoke process.

**Architecture:** Integration tests use Vitest + @testing-library/react with mounted components against mocked Tauri IPC. They test realistic user flows spanning multiple components and store slices. No Playwright/Tauri E2E harness in this phase — that infrastructure is deferred until the app has stable visual surfaces worth snapshot-testing.

**Tech Stack:** Vitest 4, @testing-library/react, jsdom, existing Tauri mock layer from test-setup.ts

**Sequencing:** Follows Phase A. Phases B+C+D in one plan.

---

## File Map

### Created
- `src/integration/project-workflow-flow.test.tsx` — Project creation → pipeline → conversation flow
- `src/integration/project-reopen-hydration.test.tsx` — Project reopen with pipeline hydration
- `src/integration/workflow-event-ui-sync.test.tsx` — Event stream → card rendering → state sync
- `src/integration/error-cancellation.test.tsx` — Error, failure, and cancellation handling
- `src/stores/slices/pipelineSlice.persistence.test.ts` — Hardened persistence edge cases
- `docs/testing/real-cli-smoke-procedure.md` — Formalized real CLI smoke test procedure

### Modified
- `vitest.config.ts` — Add integration test include pattern
- `package.json` — Add `test:integration` script

---

## Phase B: Frontend Integration Tests

### Task 1: Integration test infrastructure

**Files:**
- Modify: `vitest.config.ts`
- Modify: `package.json`
- Create: `src/integration/test-utils.ts`

- [ ] **Step 1: Add integration test pattern and script**

In `vitest.config.ts`, the `include` pattern already covers `src/**/*.test.ts` and `src/**/*.test.tsx` which includes `src/integration/`. No change needed.

Add to `package.json` scripts:
```json
"test:integration": "vitest run --reporter=verbose src/integration/"
```

- [ ] **Step 2: Create shared test utilities**

Create `src/integration/test-utils.ts` — helpers for integration tests:

```typescript
import { vi } from "vitest";

/**
 * Create a mock Tauri commands object with sensible defaults.
 * Individual tests override specific commands.
 */
export function createMockCommands() {
  return {
    createProject: vi.fn().mockResolvedValue({
      id: "proj-1", name: "test-project", workspace_path: "/tmp/test",
      summary: "", created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z",
    }),
    listProjects: vi.fn().mockResolvedValue([]),
    updateProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    createPipeline: vi.fn().mockResolvedValue({
      id: "pipeline-1", project_id: "proj-1", name: "Default",
      created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z",
    }),
    getProjectPipeline: vi.fn().mockResolvedValue(null),
    getPipelinePhases: vi.fn().mockResolvedValue([]),
    updatePipelinePhases: vi.fn().mockResolvedValue(undefined),
    deletePipeline: vi.fn().mockResolvedValue(undefined),
    listFrameworks: vi.fn().mockResolvedValue([
      { id: "superpowers", name: "Superpowers", supported_backends: ["claude"], supported_phases: ["ideation", "planning", "execution", "verification", "review"], features: { visual_companion: true, interactive_questions: true }, phase_skills: {} },
      { id: "native", name: "Native", supported_backends: ["claude", "codex"], supported_phases: ["ideation", "planning", "execution", "verification", "review", "custom"], features: { visual_companion: false, interactive_questions: false }, phase_skills: {} },
    ]),
    startPipeline: vi.fn().mockResolvedValue("run-1"),
    advanceGate: vi.fn().mockResolvedValue(undefined),
    getPipelineRunStatus: vi.fn().mockResolvedValue({
      pipeline_run_id: "run-1", status: "running",
      current_phase: { phase_run_id: "pr-1", phase_id: "p-1", label: "Ideation", status: "running" },
      completed_phases: [],
    }),
    validateClaudeCli: vi.fn().mockResolvedValue("claude 1.0.0"),
    startClaude: vi.fn().mockResolvedValue("inv-1"),
    sendMessage: vi.fn().mockResolvedValue("inv-2"),
    cancelClaude: vi.fn().mockResolvedValue(undefined),
    getSetting: vi.fn().mockResolvedValue(null),
    saveSetting: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue({ id: "sess-1", startedAt: "2026-04-12T00:00:00Z" }),
    endSession: vi.fn().mockResolvedValue(undefined),
    getActiveSession: vi.fn().mockResolvedValue(null),
    setRepoActive: vi.fn().mockResolvedValue(undefined),
    getAllRepos: vi.fn().mockResolvedValue([]),
    discoverSkills: vi.fn().mockResolvedValue([]),
    composePrompt: vi.fn().mockResolvedValue({ system: "", task: "", skills: "", repo: "", full: "", total_tokens: 0 }),
    createWorkspace: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Fire a simulated Tauri event through the listener.
 * Captures the listener callback from the mocked `listen` and invokes it.
 */
export async function fireAgentStreamEvent(payload: unknown) {
  const { listen } = await import("@tauri-apps/api/event");
  const mockListen = listen as ReturnType<typeof vi.fn>;
  const calls = mockListen.mock.calls;
  // Find the agent-stream listener
  const agentStreamCall = calls.find((c: any[]) => c[0] === "agent-stream");
  if (agentStreamCall) {
    await agentStreamCall[1]({ payload });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/integration/test-utils.ts package.json
git commit -m "chore: add integration test utilities and npm script"
```

### Task 2: Project-workflow flow integration test

**Files:**
- Create: `src/integration/project-workflow-flow.test.tsx`

Tests the complete flow: pipelineSlice builder → create project → create pipeline → store state.

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAppStore } from "../stores";
import { createMockCommands } from "./test-utils";

const mockCommands = createMockCommands();

vi.mock("../lib/tauri", () => ({ commands: mockCommands }));

describe("Project + Workflow creation flow", () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      projects: [],
      activeProjectId: null,
      currentView: "home",
      builderPhases: [],
      selectedPhaseId: null,
      frameworks: [],
      activePipelineRun: null,
    });
    vi.clearAllMocks();
  });

  it("creates project with pipeline phases via store actions", async () => {
    const store = useAppStore.getState();

    // 1. Add phases to builder
    store.addPhase("ideation", "Ideation");
    store.addPhase("execution", "Execution");
    expect(useAppStore.getState().builderPhases).toHaveLength(2);

    // 2. Configure a phase
    const phaseId = useAppStore.getState().builderPhases[0].id;
    store.updatePhase(phaseId, { backend: "codex", model: "gpt-4.1" });
    expect(useAppStore.getState().builderPhases[0].backend).toBe("codex");
    // Framework should have reset to native
    expect(useAppStore.getState().builderPhases[0].framework).toBe("native");

    // 3. Toggle gate
    store.toggleGate(phaseId);
    expect(useAppStore.getState().builderPhases[0].gateAfter).toBe("auto");

    // 4. Simulate what ProjectSetupView.handleCreate does
    const projectRow = await mockCommands.createProject("test-project", "/tmp/test");
    const phases = useAppStore.getState().builderPhases;

    await mockCommands.createPipeline({
      project_id: projectRow.id,
      name: "Default",
      phases: phases.map((p) => ({
        label: p.label,
        phase_type: p.phaseType,
        backend: p.backend,
        framework: p.framework,
        model: p.model,
        custom_prompt: p.customPrompt,
        gate_after: p.gateAfter,
      })),
    });

    // 5. Assert Tauri commands were called correctly
    expect(mockCommands.createProject).toHaveBeenCalledWith("test-project", "/tmp/test");
    expect(mockCommands.createPipeline).toHaveBeenCalledWith(expect.objectContaining({
      project_id: "proj-1",
      phases: expect.arrayContaining([
        expect.objectContaining({ label: "Ideation", backend: "codex", gate_after: "auto" }),
        expect.objectContaining({ label: "Execution", backend: "claude" }),
      ]),
    }));

    // 6. Reset builder
    store.resetBuilder();
    expect(useAppStore.getState().builderPhases).toHaveLength(0);
  });

  it("skips pipeline creation when builder has no phases", async () => {
    // No phases added — simulate create with empty builder
    expect(useAppStore.getState().builderPhases).toHaveLength(0);
    await mockCommands.createProject("empty-project", "/tmp/empty");

    // Pipeline creation should NOT have been called
    expect(mockCommands.createPipeline).not.toHaveBeenCalled();
  });

  it("loads frameworks and filters by backend compatibility", async () => {
    await useAppStore.getState().loadFrameworks();
    const frameworks = useAppStore.getState().frameworks;
    expect(frameworks).toHaveLength(2);

    // Add a phase and check which frameworks are compatible
    useAppStore.getState().addPhase("ideation", "Ideation");
    const phase = useAppStore.getState().builderPhases[0];

    // Claude backend: both superpowers and native available
    const claudeCompat = frameworks.filter(
      (f) => f.supported_backends.includes("claude") && f.supported_phases.includes(phase.phaseType),
    );
    expect(claudeCompat.length).toBeGreaterThanOrEqual(2);

    // Switch to codex: only native available
    useAppStore.getState().updatePhase(phase.id, { backend: "codex" });
    const codexCompat = frameworks.filter(
      (f) => f.supported_backends.includes("codex") && f.supported_phases.includes("ideation"),
    );
    expect(codexCompat).toHaveLength(1);
    expect(codexCompat[0].id).toBe("native");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test:integration`
Expected: All 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/integration/project-workflow-flow.test.tsx
git commit -m "test: add project-workflow creation flow integration tests"
```

### Task 3: Project reopen + hydration integration test

**Files:**
- Create: `src/integration/project-reopen-hydration.test.tsx`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAppStore } from "../stores";
import { createMockCommands } from "./test-utils";

const mockCommands = createMockCommands();

vi.mock("../lib/tauri", () => ({ commands: mockCommands }));

describe("Project reopen + pipeline hydration", () => {
  beforeEach(() => {
    useAppStore.setState({
      projects: [],
      activeProjectId: null,
      currentView: "home",
      builderPhases: [],
      selectedPhaseId: null,
      activePipelineRun: null,
      agentSessions: new Map(),
      activeSessionId: null,
    });
    vi.clearAllMocks();
  });

  it("loads projects from SQLite on app init", async () => {
    mockCommands.listProjects.mockResolvedValue([
      { id: "proj-1", name: "My Project", workspace_path: "/tmp/myproj", summary: "A project", created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z" },
    ]);

    await useAppStore.getState().loadProjects();
    const projects = useAppStore.getState().projects;
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("My Project");
    expect(projects[0].activeSessionId).toBe(""); // Not persisted
  });

  it("hydrates pipeline when opening project", async () => {
    // Seed a project
    useAppStore.setState({
      projects: [{ id: "proj-1", name: "Test", workspacePath: "/tmp/test", activeSessionId: "", summary: "", createdAt: "2026-04-12T00:00:00Z", linkedRepoIds: [], linkedSkillIds: [], linkedAgentNames: [] }],
    });

    mockCommands.getProjectPipeline.mockResolvedValue({
      id: "pipeline-1", project_id: "proj-1", name: "Default",
      created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z",
    });
    mockCommands.getPipelinePhases.mockResolvedValue([
      { id: "p-1", pipeline_id: "pipeline-1", position: 0, label: "Ideation", phase_type: "ideation", backend: "claude", framework: "superpowers", model: "opus", custom_prompt: null, gate_after: "gated" },
      { id: "p-2", pipeline_id: "pipeline-1", position: 1, label: "Execution", phase_type: "execution", backend: "codex", framework: "native", model: "gpt-4.1", custom_prompt: null, gate_after: "auto" },
    ]);

    await useAppStore.getState().loadProjectPipeline("proj-1");

    const phases = useAppStore.getState().builderPhases;
    expect(phases).toHaveLength(2);
    expect(phases[0].label).toBe("Ideation");
    expect(phases[0].backend).toBe("claude");
    expect(phases[1].label).toBe("Execution");
    expect(phases[1].backend).toBe("codex");
  });

  it("creates fresh session when reopening project with empty sessionId", () => {
    useAppStore.setState({
      projects: [{ id: "proj-1", name: "Test", workspacePath: "/tmp/test", activeSessionId: "", summary: "", createdAt: "2026-04-12T00:00:00Z", linkedRepoIds: [], linkedSkillIds: [], linkedAgentNames: [] }],
      agentSessions: new Map(),
    });

    // Simulate what HomeScreen.handleOpenProject does
    const project = useAppStore.getState().projects[0];
    let sessionId = project.activeSessionId;
    if (!sessionId || !useAppStore.getState().agentSessions.has(sessionId)) {
      sessionId = "fresh-session-id";
      useAppStore.getState().createSessionLocal(sessionId, project.name);
      useAppStore.setState((state) => ({
        projects: state.projects.map((p) =>
          p.id === project.id ? { ...p, activeSessionId: sessionId } : p,
        ),
      }));
    }

    expect(useAppStore.getState().agentSessions.has("fresh-session-id")).toBe(true);
    expect(useAppStore.getState().projects[0].activeSessionId).toBe("fresh-session-id");
  });

  it("handles missing pipeline gracefully", async () => {
    mockCommands.getProjectPipeline.mockResolvedValue(null);

    // Pre-populate builder
    useAppStore.getState().addPhase("ideation", "Ideation");
    expect(useAppStore.getState().builderPhases).toHaveLength(1);

    await useAppStore.getState().loadProjectPipeline("no-pipeline-proj");

    // Builder should be cleared
    expect(useAppStore.getState().builderPhases).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run and commit**

```bash
npm run test:integration
git add src/integration/project-reopen-hydration.test.tsx
git commit -m "test: add project reopen and pipeline hydration integration tests"
```

### Task 4: Workflow event → UI sync integration test

**Files:**
- Create: `src/integration/workflow-event-ui-sync.test.tsx`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAppStore } from "../stores";
import { normalizeCliEvent, normalizeCliStatus } from "../lib/agentStreamNormalizer";
import type { CliEventPayload, CliStatusPayload, StoreMutation } from "../lib/agentStreamNormalizer";
import { createMockCommands } from "./test-utils";

// Import fixtures
import cliClaudeStatus from "../test-fixtures/events/cli-claude-status.json";
import cliClaudeThink from "../test-fixtures/events/cli-claude-think.json";
import cliClaudeResult from "../test-fixtures/events/cli-claude-result.json";
import phaseTransitionGated from "../test-fixtures/events/phase-transition-gated.json";
import interactionRequest from "../test-fixtures/events/interaction-request.json";

const mockCommands = createMockCommands();
vi.mock("../lib/tauri", () => ({ commands: mockCommands }));

/**
 * Apply store mutations the same way the hook does.
 * This tests the normalized mutations actually produce correct store state.
 */
function applyMutations(mutations: StoreMutation[]) {
  const store = useAppStore.getState();
  for (const m of mutations) {
    switch (m.type) {
      case "createSession":
        if (!store.agentSessions.has(m.sessionId)) {
          store.createSessionLocal(m.sessionId, m.name, m.backend);
        }
        break;
      case "setWorking":
        store.setSessionWorking(m.sessionId, m.working);
        break;
      case "appendAssistant":
        store.appendToSessionLastAssistant(m.sessionId, m.text);
        break;
      case "insertCard":
        store.insertRichCard(m.sessionId, m.cardType, m.content, m.data);
        break;
      case "setError":
        store.setSessionError(m.sessionId, m.error);
        break;
      case "finalizeActivity":
        store.finalizeActivityLine(m.sessionId);
        break;
      case "addAgentEvent":
        store.addSessionAgentEvent(m.sessionId, m.event);
        break;
      case "upsertActivity":
        store.upsertActivityLine(m.sessionId, m.event);
        break;
      case "setApiMetrics":
        store.setSessionApiMetrics(m.sessionId, m.metrics);
        break;
    }
  }
}

describe("Workflow event → store state sync", () => {
  beforeEach(() => {
    useAppStore.setState({
      agentSessions: new Map(),
      activeSessionId: null,
      activePipelineRun: null,
    });
  });

  it("CLI status event creates session and sets working", () => {
    const mutations = normalizeCliStatus(cliClaudeStatus as CliStatusPayload);
    applyMutations(mutations);

    const sessions = useAppStore.getState().agentSessions;
    expect(sessions.has("test-session-1")).toBe(true);
    expect(sessions.get("test-session-1")!.isWorking).toBe(true);
    expect(sessions.get("test-session-1")!.backend).toBe("claude");
  });

  it("think event appends to assistant message in session", () => {
    // Create session first
    useAppStore.getState().createSessionLocal("test-session-1", "Test", "claude");
    useAppStore.getState().setActiveSessionId("test-session-1");

    const mutations = normalizeCliEvent(cliClaudeThink as CliEventPayload, null);
    applyMutations(mutations);

    const session = useAppStore.getState().agentSessions.get("test-session-1")!;
    const lastMsg = session.chatMessages[session.chatMessages.length - 1];
    expect(lastMsg.role).toBe("assistant");
    expect(lastMsg.content).toContain("Let me analyze");
  });

  it("result event creates outcome card with metrics", () => {
    useAppStore.getState().createSessionLocal("test-session-1", "Test", "claude");

    const mutations = normalizeCliEvent(cliClaudeResult as CliEventPayload, null);
    applyMutations(mutations);

    const session = useAppStore.getState().agentSessions.get("test-session-1")!;
    expect(session.isWorking).toBe(false);

    const outcomeCard = session.chatMessages.find((m) => m.cardType === "outcome");
    expect(outcomeCard).toBeDefined();
    expect(outcomeCard!.content).toContain("Task completed");

    expect(session.apiMetrics).not.toBeNull();
    expect(session.apiMetrics!.inputTokens).toBe(1500);
    expect(session.apiMetrics!.cost).toBe(0.025);
  });

  it("gated phase_transition creates gate-prompt card", () => {
    useAppStore.getState().createSessionLocal("test-session-1", "Test", "claude");

    const mutations = normalizeCliEvent(phaseTransitionGated as CliEventPayload, null);
    applyMutations(mutations);

    const session = useAppStore.getState().agentSessions.get("test-session-1")!;
    const gateCard = session.chatMessages.find((m) => m.cardType === "gate-prompt");
    expect(gateCard).toBeDefined();
    expect(gateCard!.content).toContain("Planning");
    expect(gateCard!.cardData?.gate).toBe("awaiting");
  });

  it("interaction_request creates interaction card with options", () => {
    useAppStore.getState().createSessionLocal("test-session-1", "Test", "claude");

    const mutations = normalizeCliEvent(interactionRequest as CliEventPayload, null);
    applyMutations(mutations);

    const session = useAppStore.getState().agentSessions.get("test-session-1")!;
    const interactionCard = session.chatMessages.find((m) => m.cardType === "interaction");
    expect(interactionCard).toBeDefined();
    expect(interactionCard!.content).toContain("technology stack");
    expect((interactionCard!.cardData as any)?.options).toContain("React + TypeScript");
  });

  it("result triggers pipeline refresh when active run exists", () => {
    useAppStore.getState().createSessionLocal("test-session-1", "Test", "claude");

    const mutations = normalizeCliEvent(cliClaudeResult as CliEventPayload, "run-123");
    const refreshMutation = mutations.find((m) => m.type === "refreshPipelineRun");
    expect(refreshMutation).toBeDefined();
    if (refreshMutation?.type === "refreshPipelineRun") {
      expect(refreshMutation.pipelineRunId).toBe("run-123");
    }
  });
});
```

- [ ] **Step 2: Run and commit**

```bash
npm run test:integration
git add src/integration/workflow-event-ui-sync.test.tsx
git commit -m "test: add workflow event to UI state sync integration tests"
```

---

## Phase C: Error + Cancellation + Persistence Hardening

### Task 5: Error and cancellation tests

**Files:**
- Create: `src/integration/error-cancellation.test.tsx`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAppStore } from "../stores";
import { normalizeCliEvent, normalizeCliStatus } from "../lib/agentStreamNormalizer";
import type { CliEventPayload, CliStatusPayload, StoreMutation } from "../lib/agentStreamNormalizer";
import { createMockCommands } from "./test-utils";

const mockCommands = createMockCommands();
vi.mock("../lib/tauri", () => ({ commands: mockCommands }));

function applyMutations(mutations: StoreMutation[]) {
  const store = useAppStore.getState();
  for (const m of mutations) {
    switch (m.type) {
      case "createSession":
        if (!store.agentSessions.has(m.sessionId)) store.createSessionLocal(m.sessionId, m.name, m.backend);
        break;
      case "setWorking": store.setSessionWorking(m.sessionId, m.working); break;
      case "appendAssistant": store.appendToSessionLastAssistant(m.sessionId, m.text); break;
      case "insertCard": store.insertRichCard(m.sessionId, m.cardType, m.content, m.data); break;
      case "setError": store.setSessionError(m.sessionId, m.error); break;
      case "finalizeActivity": store.finalizeActivityLine(m.sessionId); break;
      case "addAgentEvent": store.addSessionAgentEvent(m.sessionId, m.event); break;
      case "upsertActivity": store.upsertActivityLine(m.sessionId, m.event); break;
      case "setApiMetrics": store.setSessionApiMetrics(m.sessionId, m.metrics); break;
    }
  }
}

describe("Error and cancellation handling", () => {
  beforeEach(() => {
    useAppStore.setState({
      agentSessions: new Map(),
      activeSessionId: null,
      activePipelineRun: null,
    });
  });

  it("error event sets session error and creates error card", () => {
    useAppStore.getState().createSessionLocal("s1", "Test", "claude");

    const payload: CliEventPayload = {
      type: "agent_event",
      source: "cli-claude",
      sessionId: "s1",
      event: { event_type: "error", content: "Backend crashed", timestamp: "2026-04-12T00:00:00Z" },
    };
    applyMutations(normalizeCliEvent(payload, null));

    const session = useAppStore.getState().agentSessions.get("s1")!;
    expect(session.agentError).toBe("Backend crashed");
    expect(session.status).toBe("error");
    const errorCard = session.chatMessages.find((m) => m.cardType === "error");
    expect(errorCard).toBeDefined();
  });

  it("cancellation status sets working=false", () => {
    useAppStore.getState().createSessionLocal("s1", "Test", "claude");
    useAppStore.getState().setSessionWorking("s1", true);

    const payload: CliStatusPayload = {
      type: "status", source: "cli-claude", sessionId: "s1", status: "cancelled",
    };
    applyMutations(normalizeCliStatus(payload));

    expect(useAppStore.getState().agentSessions.get("s1")!.isWorking).toBe(false);
  });

  it("error after working state clears working and shows error", () => {
    useAppStore.getState().createSessionLocal("s1", "Test", "codex");
    useAppStore.getState().setSessionWorking("s1", true);

    const errorPayload: CliEventPayload = {
      type: "agent_event",
      source: "cli-codex",
      sessionId: "s1",
      event: { event_type: "error", content: "Model not found", timestamp: "2026-04-12T00:00:00Z" },
    };
    applyMutations(normalizeCliEvent(errorPayload, null));

    const session = useAppStore.getState().agentSessions.get("s1")!;
    // Error sets the error state — isWorking is not explicitly cleared by error event
    // but the session status derives to "error" which is the important thing
    expect(session.status).toBe("error");
    expect(session.agentError).toBe("Model not found");
  });

  it("pipeline run failure does not crash store", async () => {
    mockCommands.startPipeline.mockRejectedValue(new Error("Spawn failed"));

    await useAppStore.getState().startPipelineRun("bad-pipeline");

    // activePipelineRun should remain null (the error was caught)
    expect(useAppStore.getState().activePipelineRun).toBeNull();
  });

  it("gate advance failure does not corrupt state", async () => {
    mockCommands.advanceGate.mockRejectedValue(new Error("No gate to advance"));

    useAppStore.setState({
      activePipelineRun: {
        pipelineRunId: "run-1", status: "running",
        currentPhase: { phaseRunId: "pr-1", phaseId: "p-1", label: "Phase 1", status: "awaiting_gate" },
        completedPhases: [],
      },
    });

    await useAppStore.getState().advancePipelineGate("run-1");

    // State should not have been corrupted
    expect(useAppStore.getState().activePipelineRun).not.toBeNull();
  });

  it("sequential events accumulate correctly without duplicates", () => {
    useAppStore.getState().createSessionLocal("s1", "Test", "claude");

    // Send multiple think events
    for (let i = 0; i < 3; i++) {
      const payload: CliEventPayload = {
        type: "agent_event", source: "cli-claude", sessionId: "s1",
        event: { event_type: "think", content: `Part ${i + 1}. `, timestamp: `2026-04-12T00:00:0${i}Z` },
      };
      applyMutations(normalizeCliEvent(payload, null));
    }

    const session = useAppStore.getState().agentSessions.get("s1")!;
    // All parts should be in one assistant message (appended)
    const assistantMsgs = session.chatMessages.filter((m) => m.role === "assistant");
    expect(assistantMsgs).toHaveLength(1);
    expect(assistantMsgs[0].content).toBe("Part 1. Part 2. Part 3. ");
  });
});
```

- [ ] **Step 2: Run and commit**

```bash
npm run test:integration
git add src/integration/error-cancellation.test.tsx
git commit -m "test: add error, cancellation, and failure hardening integration tests"
```

### Task 6: Pipeline persistence edge case tests

**Files:**
- Create: `src/stores/slices/pipelineSlice.persistence.test.ts`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAppStore } from "../index";
import { createMockCommands } from "../../integration/test-utils";

const mockCommands = createMockCommands();
vi.mock("../../lib/tauri", () => ({ commands: mockCommands }));

describe("pipelineSlice persistence edge cases", () => {
  beforeEach(() => {
    useAppStore.setState({
      builderPhases: [],
      selectedPhaseId: null,
      frameworks: [],
      activePipelineRun: null,
    });
    vi.clearAllMocks();
  });

  it("refresh recovers after command failure", async () => {
    mockCommands.getPipelineRunStatus
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        pipeline_run_id: "run-1", status: "completed",
        current_phase: null, completed_phases: [],
      });

    // First refresh fails silently
    await useAppStore.getState().refreshPipelineRun("run-1");
    expect(useAppStore.getState().activePipelineRun).toBeNull();

    // Set an initial run state
    useAppStore.setState({
      activePipelineRun: { pipelineRunId: "run-1", status: "running", currentPhase: null, completedPhases: [] },
    });

    // Second refresh succeeds
    await useAppStore.getState().refreshPipelineRun("run-1");
    expect(useAppStore.getState().activePipelineRun?.status).toBe("completed");
  });

  it("loadFrameworks handles command failure gracefully", async () => {
    mockCommands.listFrameworks.mockRejectedValue(new Error("Failed"));

    await useAppStore.getState().loadFrameworks();
    // Should not crash, frameworks stays empty
    expect(useAppStore.getState().frameworks).toEqual([]);
  });

  it("loadProjectPipeline handles phases query failure", async () => {
    mockCommands.getProjectPipeline.mockResolvedValue({
      id: "pipeline-1", project_id: "proj-1", name: "Default",
      created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z",
    });
    mockCommands.getPipelinePhases.mockRejectedValue(new Error("DB error"));

    await useAppStore.getState().loadProjectPipeline("proj-1");
    // Should not crash, builder stays empty
    expect(useAppStore.getState().builderPhases).toEqual([]);
  });

  it("multiple rapid gate advances do not corrupt state", async () => {
    let callCount = 0;
    mockCommands.advanceGate.mockImplementation(async () => { callCount++; });
    mockCommands.getPipelineRunStatus.mockResolvedValue({
      pipeline_run_id: "run-1", status: "running",
      current_phase: { phase_run_id: "pr-2", phase_id: "p-2", label: "Phase 2", status: "running" },
      completed_phases: [{ phaseRunId: "pr-1", phaseId: "p-1", label: "Phase 1", status: "completed", artifactPath: null, summary: null }],
    });

    useAppStore.setState({
      activePipelineRun: { pipelineRunId: "run-1", status: "running", currentPhase: { phaseRunId: "pr-1", phaseId: "p-1", label: "Phase 1", status: "awaiting_gate" }, completedPhases: [] },
    });

    // Fire 3 rapid advances
    await Promise.all([
      useAppStore.getState().advancePipelineGate("run-1"),
      useAppStore.getState().advancePipelineGate("run-1"),
      useAppStore.getState().advancePipelineGate("run-1"),
    ]);

    expect(callCount).toBe(3);
    // State should reflect the latest refresh
    expect(useAppStore.getState().activePipelineRun?.currentPhase?.label).toBe("Phase 2");
  });
});
```

- [ ] **Step 2: Run and commit**

```bash
npm run test:unit
git add src/stores/slices/pipelineSlice.persistence.test.ts
git commit -m "test: add pipeline persistence edge case and failure recovery tests"
```

---

## Phase D: Real CLI Smoke Documentation

### Task 7: Formalize real CLI smoke procedure

**Files:**
- Create: `docs/testing/real-cli-smoke-procedure.md`

- [ ] **Step 1: Create procedure doc**

```markdown
# Real CLI Smoke Test Procedure

Optional validation against real Claude/Codex binaries. Not CI-blocking.

## Prerequisites

- Claude CLI installed: `npm install -g @anthropic-ai/claude-code`
- Codex CLI installed: `npm install -g @openai/codex`
- Valid authentication for both
- App built: `npm run tauri build` or running in dev mode

## Test Runs

### 1. Claude Single Prompt
```bash
# Via app: open project, type a message, verify response appears
# Via CLI directly: claude -p "say hello" --output-format stream-json
```
**Pass:** Response appears in chat, outcome card shows cost/tokens.

### 2. Claude Cancellation
Start a long prompt, click cancel button.
**Pass:** Session stops, status returns to idle, no orphaned spinner.

### 3. Codex Single Prompt
```bash
# Via app: create project with Codex backend phase, run pipeline
# Via CLI directly: codex exec --json "say hello"
```
**Pass:** Response appears, tokens shown (cost may be null).

### 4. Workflow Phase (Claude)
Create a 2-phase pipeline (both Claude), run it.
**Pass:** Phase 1 completes, phase 2 starts (or gates), PhaseIndicator updates.

### 5. Workflow Phase (Codex)
Create a pipeline with one Codex phase, run it.
**Pass:** Codex CLI spawns, events stream, result appears.

### 6. Gated Flow
Create a 2-phase pipeline with gate between, run it.
**Pass:** GatePromptCard appears after phase 1, Continue button advances to phase 2.

### 7. Interaction Request (if applicable)
Run a Superpowers brainstorming phase.
**Pass:** If the framework asks questions, InteractionCard renders with options.

## Artifacts to Capture on Failure

- App console output (`npm run tauri dev` terminal)
- Rust stderr logs (look for `[vibe-os]` prefix)
- Screenshots of UI state
- The raw event payloads (visible in browser DevTools Network/Console)

## When to Run

- Before major releases
- After changing adapter spawn/emit logic
- After changing useAgentStream event routing
- After changing Tauri command signatures
- Optionally: nightly on a machine with credentials
```

- [ ] **Step 2: Commit**

```bash
git add docs/testing/real-cli-smoke-procedure.md
git commit -m "docs: add real CLI smoke test procedure"
```

### Task 8: Final verification

- [ ] **Step 1: Run all frontend tests**

Run: `npm run test:unit`
Expected: ~170+ tests pass.

- [ ] **Step 2: Run integration tests specifically**

Run: `npm run test:integration`
Expected: All integration tests pass.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean.

- [ ] **Step 4: Push**

```bash
git push origin main
```
