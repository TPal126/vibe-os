# Test Enhancement Phases B, C, D

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rendered-component integration tests for real user flows (ProjectSetupView creation, HomeScreen reopen, ClaudeChat card rendering with live useAgentStream), hardening tests for errors/cancellation/malformed events, and formalize the real CLI smoke process.

**Architecture:** Integration tests render REAL components via @testing-library/react and interact via fireEvent/userEvent. Tauri IPC is mocked at the `../../lib/tauri` level. The useAgentStream hook's `listen` callback is captured from the mocked `@tauri-apps/api/event` and events are fired through it to test the full listener → store → UI chain.

**Tech Stack:** Vitest 4, @testing-library/react, jsdom, existing Tauri mock layer

**Sequencing:** Follows Phase A. All three phases in one plan.

---

## File Map

### Created
- `src/integration/test-utils.ts` — Shared mock commands factory + event fire helper
- `src/integration/project-setup-flow.test.tsx` — Rendered ProjectSetupView: name → next → builder → create
- `src/integration/project-reopen.test.tsx` — Rendered HomeScreen: loadProjects → openProject → session creation
- `src/integration/chat-workflow-cards.test.tsx` — Rendered ClaudeChat: fire events through useAgentStream → assert cards render
- `src/integration/interaction-response.test.tsx` — Rendered ClaudeChat InteractionCard: click answer → assert sendMessage/startClaude called
- `src/integration/error-malformed-cancellation.test.tsx` — Hardening: errors, malformed payloads, cancellation through real hook
- `src/stores/slices/pipelineSlice.persistence.test.ts` — Pipeline state edge cases
- `docs/testing/real-cli-smoke-procedure.md` — Formalized real CLI smoke procedure

### Modified
- `package.json` — Add `test:integration` script

---

## Phase B: Rendered Component Integration Tests

### Task 1: Integration test infrastructure

**Files:**
- Create: `src/integration/test-utils.ts`
- Modify: `package.json`

- [ ] **Step 1: Add script**

Add to `package.json` scripts:
```json
"test:integration": "vitest run --reporter=verbose src/integration/"
```

- [ ] **Step 2: Create test-utils.ts**

Create `src/integration/test-utils.ts` with a `createMockCommands()` factory that returns a full mock commands object with sensible defaults (all `vi.fn().mockResolvedValue(...)`) covering every command in `src/lib/tauri.ts`. Also add a `captureAgentStreamListener()` helper that extracts the listener callback from the mocked `listen`:

```typescript
import { vi } from "vitest";
import { listen } from "@tauri-apps/api/event";

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
    deleteSetting: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue({ id: "sess-1", startedAt: "2026-04-12T00:00:00Z" }),
    endSession: vi.fn().mockResolvedValue(undefined),
    getActiveSession: vi.fn().mockResolvedValue(null),
    setRepoActive: vi.fn().mockResolvedValue(undefined),
    getAllRepos: vi.fn().mockResolvedValue([]),
    discoverSkills: vi.fn().mockResolvedValue([]),
    composePrompt: vi.fn().mockResolvedValue({ system: "", task: "", skills: "", repo: "", full: "", total_tokens: 0 }),
    syncSkillsToClaude: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(""),
    writeFile: vi.fn().mockResolvedValue(undefined),
    logAction: vi.fn().mockResolvedValue(undefined),
    getAuditLog: vi.fn().mockResolvedValue([]),
    createWorkspace: vi.fn().mockResolvedValue(undefined),
    openWorkspace: vi.fn().mockResolvedValue(undefined),
    saveRepo: vi.fn().mockResolvedValue({}),
    listClaudeCodeSessions: vi.fn().mockResolvedValue([]),
    createClaudeSession: vi.fn().mockResolvedValue({}),
    listClaudeSessions: vi.fn().mockResolvedValue([]),
    recordDecision: vi.fn().mockResolvedValue({}),
    getSessionDecisions: vi.fn().mockResolvedValue([]),
    logEvent: vi.fn().mockResolvedValue({}),
    getSessionEvents: vi.fn().mockResolvedValue([]),
  };
}

/**
 * Get the agent-stream listener callback from the mocked listen function.
 * Returns a function you can call with a payload to simulate events.
 */
export function getAgentStreamFirer(): (payload: unknown) => void {
  const mockListen = listen as ReturnType<typeof vi.fn>;
  const call = mockListen.mock.calls.find((c: any[]) => c[0] === "agent-stream");
  if (!call) throw new Error("No agent-stream listener registered. Did useAgentStream mount?");
  const callback = call[1];
  return (payload: unknown) => callback({ payload });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/integration/test-utils.ts package.json
git commit -m "chore: add integration test utilities and npm script"
```

### Task 2: Rendered ProjectSetupView flow test

**Files:**
- Create: `src/integration/project-setup-flow.test.tsx`

This test renders the REAL ProjectSetupView component, types into inputs, clicks buttons, and asserts Tauri commands are called.

- [ ] **Step 1: Create test**

The test needs to mock several child components that ProjectSetupView renders (ResourceCatalog, RepoBrowseModal, RepoGithubModal, WorkflowBuilder) since those have their own complex dependency trees. Mock them as simple divs. Also mock the store selectors for workspace creation.

Read `src/components/home/ProjectSetupView.tsx` to understand what it imports and renders. The implementer should:

1. Mock `../../lib/tauri` with `createMockCommands()`
2. Mock heavy child components (ResourceCatalog, WorkflowBuilder, modals) as simple stubs
3. Set up the store's `activeWorkspace` to simulate workspace creation
4. Render `<ProjectSetupView />`
5. Type a project name, click "Next: Configure Pipeline"
6. Assert step 2 renders (WorkflowBuilder stub visible)
7. Click "Create Project"
8. Assert `commands.createProject` was called with the right name
9. Assert `commands.createPipeline` was called if builderPhases were present

Key scenarios:
- **Happy path:** name → next → create → commands called correctly
- **Validation:** empty name shows error, button disabled
- **Back button:** step 2 → back → step 1 preserves name

- [ ] **Step 2: Run and commit**

```bash
npm run test:integration
git add src/integration/project-setup-flow.test.tsx
git commit -m "test: add rendered ProjectSetupView flow integration test"
```

### Task 3: Rendered HomeScreen reopen test

**Files:**
- Create: `src/integration/project-reopen.test.tsx`

This test validates the REAL reopen contract: `loadProjects` → projects appear → `openProject` → session created → pipeline hydrated.

- [ ] **Step 1: Create test**

The test should:
1. Mock `commands.listProjects` to return a saved project
2. Call `loadProjects()` on the store
3. Render HomeScreen (or test the store flow that HomeScreen.handleOpenProject exercises)
4. Verify that opening a project with `activeSessionId: ""` triggers `createSessionLocal` with a new UUID
5. Verify `loadProjectPipeline` is called
6. Verify the store's `activeSessionId` is no longer empty

For the rendered version: render `<HomeScreen />`, find the project card, click it, assert `openProject` was called. Mock `openWorkspace` so it doesn't fail.

Key scenario that tests the REAL bug: projects loaded from SQLite have `activeSessionId: ""`. When opened, a fresh session must be created. Assert that `agentSessions` gains a new entry.

- [ ] **Step 2: Run and commit**

```bash
git add src/integration/project-reopen.test.tsx
git commit -m "test: add rendered HomeScreen project reopen integration test"
```

### Task 4: ClaudeChat workflow card rendering via live useAgentStream

**Files:**
- Create: `src/integration/chat-workflow-cards.test.tsx`

This is the key test that was missing: fire events through the REAL useAgentStream listener and assert that cards render in ClaudeChat.

- [ ] **Step 1: Create test**

The test should:
1. Mock `../../lib/tauri` with full commands
2. Set up a session in the store
3. Render a component that mounts useAgentStream (the hook is mounted in App.tsx; in tests, render a minimal wrapper that calls `useAgentStream()` + renders the session's chat messages)
4. Use `getAgentStreamFirer()` to get the listener callback
5. Fire a CLI status event → assert session created, working state set
6. Fire a think event → assert assistant message appears
7. Fire a result event → assert outcome card appears
8. Fire a phase_transition gated event → assert gate-prompt card appears
9. Fire an interaction_request event → assert interaction card appears

Since rendering full ClaudeChat is complex (many dependencies), the implementer can either:
- Mock enough of ClaudeChat's dependencies to render it
- OR render a thin wrapper that reads from the store and renders cards (testing the hook + store integration, with card rendering tested separately in Phase A component tests)

The critical thing: events flow through the REAL `listen` callback → REAL `useAgentStream` hook → REAL store → assert correct state.

- [ ] **Step 2: Run and commit**

```bash
git add src/integration/chat-workflow-cards.test.tsx
git commit -m "test: add live useAgentStream to store card rendering integration test"
```

---

## Phase C: Hardening

### Task 5: Interaction response routing test

**Files:**
- Create: `src/integration/interaction-response.test.tsx`

Tests the ClaudeChat InteractionCard answer path: clicking an answer calls either `sendMessage` or `startClaude` depending on whether the session has a `conversationId`.

- [ ] **Step 1: Create test**

Two scenarios:
1. **With conversationId:** Set up a session with `conversationId: "conv-123"`. Insert an interaction card into the session. Render the InteractionCard (or ClaudeChat). Click an option. Assert `commands.sendMessage` was called with the answer and conversationId.
2. **Without conversationId:** Set up a session with `conversationId: null`. Same flow. Assert `commands.startClaude` was called with the answer as message.

The implementer should read `src/components/panels/ClaudeChat.tsx` lines ~332-377 to understand the onRespond handler, then write tests that exercise both branches.

- [ ] **Step 2: Run and commit**

```bash
git add src/integration/interaction-response.test.tsx
git commit -m "test: add interaction response routing test (sendMessage vs startClaude)"
```

### Task 6: Error, malformed event, and cancellation hardening

**Files:**
- Create: `src/integration/error-malformed-cancellation.test.tsx`

Tests through the REAL useAgentStream listener path.

- [ ] **Step 1: Create test**

Scenarios:
1. **Error event → error card + session error state:** Fire an error event through the listener. Assert `agentError` is set and an error card appears in the session.
2. **Cancellation → working=false:** Fire a working status, then a cancelled status. Assert isWorking goes true → false.
3. **Malformed payload → no crash:** Fire the malformed.json fixture through the listener. Assert no exception thrown, store state unchanged (no new sessions created, no cards inserted).
4. **Error after active work → proper cleanup:** Fire working → think → error. Assert the session has the think text AND the error state, no orphaned activity.
5. **Sequential events accumulate correctly:** Fire 3 think events. Assert one assistant message with all 3 parts concatenated.

All events fire through `getAgentStreamFirer()` to test the real listener path.

- [ ] **Step 2: Run and commit**

```bash
git add src/integration/error-malformed-cancellation.test.tsx
git commit -m "test: add error, malformed event, and cancellation hardening tests"
```

### Task 7: Pipeline persistence edge cases

**Files:**
- Create: `src/stores/slices/pipelineSlice.persistence.test.ts`

- [ ] **Step 1: Create test**

Scenarios:
1. **Refresh after command failure recovers gracefully**
2. **loadFrameworks handles failure silently**
3. **loadProjectPipeline handles phases query failure**
4. **Multiple rapid gate advances don't corrupt state**

These test the store directly (not rendered components) — appropriate since they're testing async state resilience.

- [ ] **Step 2: Run and commit**

```bash
git add src/stores/slices/pipelineSlice.persistence.test.ts
git commit -m "test: add pipeline persistence edge case and failure recovery tests"
```

---

## Phase D: Real CLI Smoke Documentation

### Task 8: Formalize real CLI smoke procedure

**Files:**
- Create: `docs/testing/real-cli-smoke-procedure.md`

- [ ] **Step 1: Create doc**

Document the manual procedure for testing against real Claude and Codex CLIs. Cover: prerequisites (CLI installed, authenticated), 7 test runs (Claude single prompt, Claude cancellation, Codex single prompt, workflow phase Claude, workflow phase Codex, gated flow, interaction request), artifacts to capture on failure, when to run.

- [ ] **Step 2: Commit**

```bash
git add docs/testing/real-cli-smoke-procedure.md
git commit -m "docs: add real CLI smoke test procedure"
```

### Task 9: Final verification + push

- [ ] **Step 1: Run all tests**

```bash
npm run test:unit
npm run test:integration
npx tsc --noEmit
```
Expected: All tests pass, tsc clean.

- [ ] **Step 2: Push**

```bash
git push origin main
```
