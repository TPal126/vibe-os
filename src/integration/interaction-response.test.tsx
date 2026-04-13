import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act, fireEvent } from "@testing-library/react";

// Import fixtures
import interactionRequest from "../test-fixtures/events/interaction-request.json";

// ── Hoist mockCommands before vi.mock factory runs ──

const mockCommands = vi.hoisted(() => {
  const fn = vi.fn;
  return {
    analyzeArchitecture: fn().mockResolvedValue({ nodes: [], edges: [] }),
    graphGetTopology: fn().mockResolvedValue({ repos: [], modules: [], edges: [] }),
    testDbWrite: fn().mockResolvedValue("ok"),
    testDbRead: fn().mockResolvedValue("ok"),
    testSpawn: fn().mockResolvedValue("ok"),
    createSession: fn().mockResolvedValue({ id: "sess-1", startedAt: "2026-04-12T00:00:00Z" }),
    endSession: fn().mockResolvedValue(undefined),
    getActiveSession: fn().mockResolvedValue(null),
    updateSessionRepos: fn().mockResolvedValue(undefined),
    updateSessionSkills: fn().mockResolvedValue(undefined),
    updateSessionPrompt: fn().mockResolvedValue(undefined),
    getSetting: fn().mockResolvedValue(null),
    saveSetting: fn().mockResolvedValue(undefined),
    deleteSetting: fn().mockResolvedValue(undefined),
    saveRepo: fn().mockResolvedValue({
      id: "repo-1", name: "test-repo", source: "local", path: "/tmp/repo",
      git_url: null, branch: "main", language: "typescript", file_count: 0,
      active: true, parent_id: null, created_at: "2026-04-12T00:00:00Z",
    }),
    getAllRepos: fn().mockResolvedValue([]),
    deleteRepo: fn().mockResolvedValue(undefined),
    setRepoActive: fn().mockResolvedValue(undefined),
    refreshRepoBranch: fn().mockResolvedValue("main"),
    cloneRepo: fn().mockResolvedValue({
      id: "repo-2", name: "cloned-repo", source: "git", path: "/tmp/cloned",
      git_url: "https://github.com/example/repo.git", branch: "main",
      language: "typescript", file_count: 0, active: true, parent_id: null,
      created_at: "2026-04-12T00:00:00Z",
    }),
    indexRepo: fn().mockResolvedValue("indexed"),
    listRemoteBranches: fn().mockResolvedValue([]),
    addBranchWorktree: fn().mockResolvedValue({
      id: "repo-3", name: "worktree-repo", source: "local", path: "/tmp/worktree",
      git_url: null, branch: "feature", language: "typescript", file_count: 0,
      active: true, parent_id: "repo-1", created_at: "2026-04-12T00:00:00Z",
    }),
    removeBranchWorktree: fn().mockResolvedValue(undefined),
    discoverSkills: fn().mockResolvedValue([]),
    composePrompt: fn().mockResolvedValue({
      system: "", task: "", skills: "", repo: "", full: "", total_tokens: 0,
    }),
    syncSkillsToClaude: fn().mockResolvedValue([]),
    readFile: fn().mockResolvedValue(""),
    writeFile: fn().mockResolvedValue(undefined),
    logAction: fn().mockResolvedValue(undefined),
    getAuditLog: fn().mockResolvedValue([]),
    validateClaudeCli: fn().mockResolvedValue("claude 1.0.0"),
    startClaude: fn().mockResolvedValue("inv-1"),
    sendMessage: fn().mockResolvedValue("inv-2"),
    cancelClaude: fn().mockResolvedValue(undefined),
    listClaudeCodeSessions: fn().mockResolvedValue([]),
    attachClaudeCodeSession: fn().mockResolvedValue("inv-3"),
    createClaudeSession: fn().mockResolvedValue({
      id: "csess-1", name: "Default", created_at: "2026-04-12T00:00:00Z",
      status: "active", conversation_id: null,
    }),
    listClaudeSessions: fn().mockResolvedValue([]),
    closeClaudeSession: fn().mockResolvedValue(undefined),
    getClaudeSession: fn().mockResolvedValue({
      id: "csess-1", name: "Default", created_at: "2026-04-12T00:00:00Z",
      status: "active", conversation_id: null,
    }),
    recordDecision: fn().mockResolvedValue({
      id: "dec-1", session_id: "sess-1", timestamp: "2026-04-12T00:00:00Z",
      decision: "", rationale: "", confidence: 1.0, impact_category: "low",
      reversible: true, related_files: [], related_tickets: [],
    }),
    getSessionDecisions: fn().mockResolvedValue([]),
    exportDecisions: fn().mockResolvedValue(undefined),
    getSessionAudit: fn().mockResolvedValue([]),
    exportAuditLog: fn().mockResolvedValue(undefined),
    logEvent: fn().mockResolvedValue({
      id: "evt-1", session_id: "sess-1", timestamp: "2026-04-12T00:00:00Z",
      kind: "action", action_type: null, detail: null, actor: null,
      metadata: null, rationale: null, confidence: null, impact_category: null,
      reversible: null, related_files: null, related_tickets: null,
    }),
    getEvents: fn().mockResolvedValue([]),
    exportEvents: fn().mockResolvedValue(undefined),
    getSessionScripts: fn().mockResolvedValue([]),
    generateSkillFromScript: fn().mockResolvedValue({
      id: "skill-1", label: "Generated Skill", category: "custom",
      tokens: 0, file_path: "/tmp/skill.md", source: "generated",
    }),
    createWorkspace: fn().mockResolvedValue({
      name: "test-workspace", path: "/tmp/workspace",
      has_claude_md: false, repo_count: 0, skill_count: 0,
    }),
    openWorkspace: fn().mockResolvedValue({
      name: "test-workspace", path: "/tmp/workspace",
      has_claude_md: false, repo_count: 0, skill_count: 0,
    }),
    readWorkspaceTree: fn().mockResolvedValue([]),
    watchWorkspaceClaudeMd: fn().mockResolvedValue(undefined),
    stopWorkspaceWatcher: fn().mockResolvedValue(undefined),
    setTokenBudget: fn().mockResolvedValue({
      id: "budget-1", scope_type: "session", scope_id: "sess-1",
      max_tokens: 100000, warning_threshold: 80000,
      created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z",
    }),
    getTokenBudgets: fn().mockResolvedValue([]),
    deleteTokenBudget: fn().mockResolvedValue(undefined),
    detectAvailableClis: fn().mockResolvedValue([]),
    createProject: fn().mockResolvedValue({
      id: "proj-1", name: "test-project", workspace_path: "/tmp/test",
      summary: "", created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z",
    }),
    listProjects: fn().mockResolvedValue([]),
    updateProject: fn().mockResolvedValue(undefined),
    deleteProject: fn().mockResolvedValue(undefined),
    createPipeline: fn().mockResolvedValue({
      id: "pipeline-1", project_id: "proj-1", name: "Default",
      created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z",
    }),
    getProjectPipeline: fn().mockResolvedValue(null),
    getPipelinePhases: fn().mockResolvedValue([]),
    updatePipelinePhases: fn().mockResolvedValue(undefined),
    deletePipeline: fn().mockResolvedValue(undefined),
    listFrameworks: fn().mockResolvedValue([]),
    saveAgentDefinition: fn().mockResolvedValue({
      name: "test-agent", description: "", system_prompt: "", tools: [],
      created_at: "2026-04-12T00:00:00Z", source_session_id: "sess-1",
      model: null, permission_mode: null, disallowed_tools: [], max_turns: null,
      background: false, isolation: null, memory: null, skills: [], color: null,
    }),
    loadAgentDefinitions: fn().mockResolvedValue([]),
    removeAgentDefinition: fn().mockResolvedValue(undefined),
    getWorkspaceAgentDir: fn().mockResolvedValue("/tmp/workspace/.agents"),
    startPipeline: fn().mockResolvedValue("run-1"),
    advanceGate: fn().mockResolvedValue(undefined),
    getPipelineRunStatus: fn().mockResolvedValue({
      pipeline_run_id: "run-1", status: "running",
      current_phase: {
        phase_run_id: "pr-1", phase_id: "p-1", label: "Ideation",
        status: "running", artifact_path: null, summary: null,
      },
      completed_phases: [],
    }),
  };
});

// ── Mock Tauri commands ──

vi.mock("../lib/tauri", () => ({
  commands: mockCommands,
  showOpenWorkspaceDialog: vi.fn(),
}));

// ── Mock agentCommands (used by ClaudeChat for sidecar detection) ──

vi.mock("../lib/agentCommands", () => ({
  agentCommands: {
    ensureSidecar: vi.fn().mockResolvedValue("ready"),
    startAgent: vi.fn().mockResolvedValue(undefined),
    sendAgentMessage: vi.fn().mockResolvedValue(undefined),
    cancelAgent: vi.fn().mockResolvedValue(undefined),
    getSidecarStatus: vi.fn().mockRejectedValue(new Error("no sidecar in test")),
  },
}));

// ── Mock heavy child components as lightweight stubs ──
// Keep InteractionCard REAL so choice buttons are in the DOM.

vi.mock("../components/panels/SessionTabs", () => ({
  SessionTabs: () => <div data-testid="session-tabs" />,
}));

vi.mock("../components/conversation/ActivityLine", () => ({
  ActivityLine: ({ message }: any) => (
    <div data-testid="activity-line">{message.content}</div>
  ),
}));

vi.mock("../components/conversation/OutcomeCard", () => ({
  OutcomeCard: ({ message }: any) => (
    <div data-testid="outcome-card">{message.content}</div>
  ),
}));

vi.mock("../components/conversation/ErrorCard", () => ({
  ErrorCard: ({ message }: any) => (
    <div data-testid="error-card">{message.content}</div>
  ),
}));

vi.mock("../components/conversation/InlineDecisionCard", () => ({
  InlineDecisionCard: ({ message }: any) => (
    <div data-testid="decision-card">{message.content}</div>
  ),
}));

vi.mock("../components/conversation/InlinePreviewCard", () => ({
  InlinePreviewCard: ({ message }: any) => (
    <div data-testid="preview-card">{message.content}</div>
  ),
}));

vi.mock("../components/conversation/TestDetailCard", () => ({
  TestDetailCard: ({ message }: any) => (
    <div data-testid="test-detail-card">{message?.content}</div>
  ),
}));

vi.mock("../components/conversation/TaskProgressCard", () => ({
  TaskProgressCard: () => <div data-testid="task-progress-card" />,
}));

vi.mock("../components/conversation/CodeBlockSummary", () => ({
  CodeBlockSummary: () => <div data-testid="code-block-summary" />,
}));

vi.mock("../components/conversation/PhaseIndicator", () => ({
  PhaseIndicator: () => <div data-testid="phase-indicator" />,
}));

vi.mock("../components/conversation/GatePromptCard", () => ({
  GatePromptCard: ({ message }: any) => (
    <div data-testid="gate-prompt-card">{message.content}</div>
  ),
}));

vi.mock("../components/shared/IconButton", () => ({
  IconButton: ({ onClick, title }: any) => (
    <button onClick={onClick} title={title} data-testid="icon-button">
      {title}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Send: () => <span data-testid="icon-send" />,
  Square: () => <span data-testid="icon-square" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  Plus: () => <span data-testid="icon-plus" />,
  X: () => <span data-testid="icon-x" />,
  Dot: () => <span data-testid="icon-dot" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  Circle: () => <span data-testid="icon-circle" />,
  Loader: () => <span data-testid="icon-loader" />,
  PauseCircle: () => <span data-testid="icon-pause-circle" />,
  Play: () => <span data-testid="icon-play" />,
  MessageSquare: () => <span data-testid="icon-message-square" />,
}));

// ── Polyfill scrollIntoView for jsdom ──

Element.prototype.scrollIntoView = vi.fn();

// ── Imports that depend on mocks ──

import { ClaudeChat } from "../components/panels/ClaudeChat";
import { useAgentStream } from "../hooks/useAgentStream";
import { useAppStore } from "../stores";
import { getAgentStreamFirer } from "./test-utils";

// ── Test wrapper that mounts both useAgentStream and ClaudeChat ──

function TestWrapper() {
  useAgentStream();
  return <ClaudeChat />;
}

// ── Store setup helpers ──

function resetStore() {
  useAppStore.setState({
    repos: [],
    activeWorkspace: null,
    workspaceLoading: false,
    workspaceTree: null,
    projects: [{
      id: "proj-1",
      name: "test-project",
      workspacePath: "/tmp/test",
      activeSessionId: "sess-1",
      summary: "",
      createdAt: "2026-04-12T00:00:00Z",
      linkedRepoIds: [],
      linkedSkillIds: [],
      linkedAgentNames: [],
    }],
    activeProjectId: "proj-1",
    currentView: "conversation" as const,
    builderPhases: [],
    selectedPhaseId: null,
    frameworks: [],
    agentSessions: new Map(),
    activeSessionId: null,
    systemPrompt: "",
    skills: [],
    cliAvailable: { claude: true },
    cliError: {},
    activePipelineRun: null,
  });
}

function setupSessionWithConversationId(conversationId: string | null) {
  const store = useAppStore.getState();
  store.createSessionLocal("test-session-1", "Test Session", "claude");
  store.setActiveSessionId("test-session-1");
  if (conversationId) {
    store.setSessionConversationId("test-session-1", conversationId);
  }
}

// ── Tests ──

describe("ClaudeChat interaction response routing", () => {
  beforeEach(() => {
    resetStore();
    mockCommands.sendMessage.mockClear();
    mockCommands.startClaude.mockClear();
  });

  afterEach(cleanup);

  it("calls sendMessage when session has a conversationId", async () => {
    setupSessionWithConversationId("conv-123");

    await act(async () => {
      render(<TestWrapper />);
    });

    const fire = getAgentStreamFirer();

    // Fire an interaction request to insert the interaction card
    await act(async () => {
      fire(interactionRequest);
    });

    // Wait for the interaction card to appear with choice buttons
    await waitFor(() => {
      expect(screen.getByText("React + TypeScript")).toBeDefined();
    });

    // Click one of the choice buttons
    await act(async () => {
      fireEvent.click(screen.getByText("React + TypeScript"));
    });

    // Assert sendMessage was called (resume existing conversation)
    await waitFor(() => {
      expect(mockCommands.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockCommands.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "React + TypeScript",
          conversationId: "conv-123",
          agentSessionId: "test-session-1",
        }),
      );
    });

    // Verify startClaude was NOT called
    expect(mockCommands.startClaude).not.toHaveBeenCalled();
  });

  it("calls startClaude when session has no conversationId", async () => {
    setupSessionWithConversationId(null);

    await act(async () => {
      render(<TestWrapper />);
    });

    const fire = getAgentStreamFirer();

    // Fire an interaction request to insert the interaction card
    await act(async () => {
      fire(interactionRequest);
    });

    // Wait for the interaction card to appear with choice buttons
    await waitFor(() => {
      expect(screen.getByText("React + TypeScript")).toBeDefined();
    });

    // Click one of the choice buttons
    await act(async () => {
      fireEvent.click(screen.getByText("React + TypeScript"));
    });

    // Assert startClaude was called (no existing conversation)
    await waitFor(() => {
      expect(mockCommands.startClaude).toHaveBeenCalledTimes(1);
      expect(mockCommands.startClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "React + TypeScript",
          agent_session_id: "test-session-1",
        }),
      );
    });

    // Verify sendMessage was NOT called
    expect(mockCommands.sendMessage).not.toHaveBeenCalled();
  });

  it("does not crash when activeSessionId is null at the time of response", async () => {
    setupSessionWithConversationId("conv-456");

    await act(async () => {
      render(<TestWrapper />);
    });

    const fire = getAgentStreamFirer();

    // Fire an interaction request to insert the interaction card
    await act(async () => {
      fire(interactionRequest);
    });

    // Wait for the interaction card to appear
    await waitFor(() => {
      expect(screen.getByText("React + TypeScript")).toBeDefined();
    });

    // Null out activeSessionId (but keep the session in the map so the card stays rendered)
    await act(async () => {
      useAppStore.getState().setActiveSessionId(null);
    });

    // The card should still be in the DOM because the component's chatMessages were
    // captured before the re-render. But the onRespond handler reads activeSessionId
    // at call time — it should be null and the handler should bail out gracefully.
    // If the card is gone due to re-render, that's also fine — it means the UI
    // correctly removed it. Either way, no crash.
    const choiceButton = screen.queryByText("React + TypeScript");
    if (choiceButton) {
      await act(async () => {
        fireEvent.click(choiceButton);
      });
    }

    // Neither sendMessage nor startClaude should have been called
    expect(mockCommands.sendMessage).not.toHaveBeenCalled();
    expect(mockCommands.startClaude).not.toHaveBeenCalled();
  });

  it("does not send backend commands when session is missing from sessions map", async () => {
    setupSessionWithConversationId(null);

    await act(async () => {
      render(<TestWrapper />);
    });

    const fire = getAgentStreamFirer();

    // Fire an interaction request
    await act(async () => {
      fire(interactionRequest);
    });

    await waitFor(() => {
      expect(screen.getByText("React + TypeScript")).toBeDefined();
    });

    // Remove the session from the sessions map but keep activeSessionId pointed to it.
    // This simulates a race condition where the session was cleaned up.
    await act(async () => {
      useAppStore.setState((state) => {
        const next = new Map(state.agentSessions);
        next.delete("test-session-1");
        return { agentSessions: next };
      });
    });

    // The card should vanish since chatMessages is now empty, but let's check
    const choiceButton = screen.queryByText("React + TypeScript");
    if (choiceButton) {
      // If the card is still somehow visible, clicking should not crash
      await act(async () => {
        fireEvent.click(choiceButton);
      });
    }

    // Backend commands should not have been called
    expect(mockCommands.sendMessage).not.toHaveBeenCalled();
    expect(mockCommands.startClaude).not.toHaveBeenCalled();
  });
});
