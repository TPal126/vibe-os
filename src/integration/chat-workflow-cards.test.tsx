import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";

// Import fixtures
import cliClaudeStatus from "../test-fixtures/events/cli-claude-status.json";
import cliClaudeThink from "../test-fixtures/events/cli-claude-think.json";
import cliClaudeResult from "../test-fixtures/events/cli-claude-result.json";
import phaseTransitionGated from "../test-fixtures/events/phase-transition-gated.json";
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

vi.mock("../components/conversation/InteractionCard", () => ({
  InteractionCard: ({ message }: any) => (
    <div data-testid="interaction-card">{message.content}</div>
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
}));

// ── Polyfill scrollIntoView for jsdom (not implemented) ──

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
    projects: [],
    activeProjectId: null,
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

/**
 * Set up a session in the store so ClaudeChat renders the chat area.
 * Uses the same session ID as the test fixtures ("test-session-1").
 */
function setupActiveSession() {
  const store = useAppStore.getState();
  store.createSessionLocal("test-session-1", "Test Session", "claude");
  store.setActiveSessionId("test-session-1");
}

// ── Tests ──

describe("ClaudeChat + useAgentStream integration", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(cleanup);

  it("renders empty state when no active session exists", async () => {
    await act(async () => {
      render(<TestWrapper />);
    });

    expect(
      screen.getByText("Click '+' above to start a new Claude session"),
    ).toBeDefined();
  });

  it("renders empty chat prompt when session exists but no messages", async () => {
    setupActiveSession();

    await act(async () => {
      render(<TestWrapper />);
    });

    expect(
      screen.getByText("Send a message to start a conversation with Claude"),
    ).toBeDefined();
  });

  it("shows assistant text when a think event is fired", async () => {
    setupActiveSession();

    await act(async () => {
      render(<TestWrapper />);
    });

    const fire = getAgentStreamFirer();

    // Fire status first (creates session in the stream listener if not present)
    await act(async () => {
      fire(cliClaudeStatus);
    });

    // Fire think event — should append assistant text
    await act(async () => {
      fire(cliClaudeThink);
    });

    // The think content should appear as an assistant message bubble
    await waitFor(() => {
      expect(screen.getByText("Let me analyze that for you.")).toBeDefined();
    });
  });

  it("shows outcome card when a result event is fired", async () => {
    setupActiveSession();

    await act(async () => {
      render(<TestWrapper />);
    });

    const fire = getAgentStreamFirer();

    // Fire status to initialize
    await act(async () => {
      fire(cliClaudeStatus);
    });

    // Fire result event — should insert an outcome card
    await act(async () => {
      fire(cliClaudeResult);
    });

    await waitFor(() => {
      const outcomeCard = screen.getByTestId("outcome-card");
      expect(outcomeCard).toBeDefined();
      expect(outcomeCard.textContent).toContain("Task completed successfully.");
    });
  });

  it("shows gate-prompt card when a gated phase_transition event is fired", async () => {
    setupActiveSession();

    await act(async () => {
      render(<TestWrapper />);
    });

    const fire = getAgentStreamFirer();

    // Fire the gated phase transition
    await act(async () => {
      fire(phaseTransitionGated);
    });

    await waitFor(() => {
      const gateCard = screen.getByTestId("gate-prompt-card");
      expect(gateCard).toBeDefined();
      expect(gateCard.textContent).toContain("Review and continue");
    });
  });

  it("shows interaction card when an interaction_request event is fired", async () => {
    setupActiveSession();

    await act(async () => {
      render(<TestWrapper />);
    });

    const fire = getAgentStreamFirer();

    // Fire interaction request
    await act(async () => {
      fire(interactionRequest);
    });

    await waitFor(() => {
      const interactionCard = screen.getByTestId("interaction-card");
      expect(interactionCard).toBeDefined();
      expect(interactionCard.textContent).toContain(
        "What technology stack would you like to use?",
      );
    });
  });

  it("fires a full sequence: status -> think -> result and all appear in DOM", async () => {
    setupActiveSession();

    await act(async () => {
      render(<TestWrapper />);
    });

    const fire = getAgentStreamFirer();

    // 1. Status event (working)
    await act(async () => {
      fire(cliClaudeStatus);
    });

    // 2. Think event (assistant text)
    await act(async () => {
      fire(cliClaudeThink);
    });

    await waitFor(() => {
      expect(screen.getByText("Let me analyze that for you.")).toBeDefined();
    });

    // 3. Result event (outcome card)
    await act(async () => {
      fire(cliClaudeResult);
    });

    await waitFor(() => {
      const outcomeCard = screen.getByTestId("outcome-card");
      expect(outcomeCard).toBeDefined();
      expect(outcomeCard.textContent).toContain("Task completed successfully.");
    });

    // Both the assistant text and outcome card should coexist
    expect(screen.getByText("Let me analyze that for you.")).toBeDefined();
  });

  it("shows error card when an error event is fired", async () => {
    setupActiveSession();

    await act(async () => {
      render(<TestWrapper />);
    });

    const fire = getAgentStreamFirer();

    const errorEvent = {
      type: "agent_event",
      source: "cli-claude",
      sessionId: "test-session-1",
      event: {
        event_type: "error",
        content: "Something went wrong during execution.",
        timestamp: "2026-04-12T00:00:15Z",
      },
    };

    await act(async () => {
      fire(errorEvent);
    });

    await waitFor(() => {
      const errorCard = screen.getByTestId("error-card");
      expect(errorCard).toBeDefined();
      expect(errorCard.textContent).toContain("Something went wrong during execution.");
    });
  });

  it("handles multiple card types in a single session", async () => {
    setupActiveSession();

    await act(async () => {
      render(<TestWrapper />);
    });

    const fire = getAgentStreamFirer();

    // Fire a think event
    await act(async () => {
      fire(cliClaudeThink);
    });

    // Fire gate-prompt
    await act(async () => {
      fire(phaseTransitionGated);
    });

    // Fire interaction request
    await act(async () => {
      fire(interactionRequest);
    });

    // Fire result
    await act(async () => {
      fire(cliClaudeResult);
    });

    await waitFor(() => {
      // All card types should be present simultaneously
      expect(screen.getByText("Let me analyze that for you.")).toBeDefined();
      expect(screen.getByTestId("gate-prompt-card")).toBeDefined();
      expect(screen.getByTestId("interaction-card")).toBeDefined();
      expect(screen.getByTestId("outcome-card")).toBeDefined();
    });
  });
});
