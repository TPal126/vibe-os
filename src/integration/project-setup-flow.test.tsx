import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// ── Hoist mockCommands so it's populated before any vi.mock factory runs ──

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

// ── Mock heavy child components ──

vi.mock("../components/home/ResourceCatalog", () => ({
  ResourceCatalog: () => <div data-testid="resource-catalog">ResourceCatalog</div>,
}));

vi.mock("../components/home/RepoBrowseModal", () => ({
  RepoBrowseModal: () => null,
}));

vi.mock("../components/home/RepoGithubModal", () => ({
  RepoGithubModal: () => null,
}));

vi.mock("../components/home/WorkflowBuilder", () => ({
  WorkflowBuilder: () => <div data-testid="workflow-builder">Builder</div>,
}));

// ── Mock Tauri commands ──

vi.mock("../lib/tauri", () => ({
  commands: mockCommands,
  showOpenWorkspaceDialog: vi.fn(),
}));

// ── Imports that depend on mocks ──

import { ProjectSetupView } from "../components/home/ProjectSetupView";
import { useAppStore } from "../stores";

// ── Helpers ──

/** Reset store data to a clean baseline before each test (merge, not replace, to keep actions). */
function resetStore() {
  useAppStore.setState({
    repos: [],
    activeWorkspace: null,
    workspaceLoading: false,
    workspaceTree: null,
    projects: [],
    activeProjectId: null,
    currentView: "project-setup" as const,
    builderPhases: [],
    selectedPhaseId: null,
    frameworks: [],
    agentSessions: new Map(),
    activeSessionId: null,
    systemPrompt: "",
    skills: [],
  });
}

describe("ProjectSetupView integration", () => {
  beforeEach(() => {
    resetStore();
    // Reset all mock call counts
    Object.values(mockCommands).forEach((fn) => {
      if (typeof fn === "function" && "mockClear" in fn) {
        (fn as ReturnType<typeof vi.fn>).mockClear();
      }
    });
  });

  afterEach(cleanup);

  // ── Scenario 1: Step 1 validation ──

  describe("Step 1 validation", () => {
    it("disables 'Next: Configure Pipeline' when name is empty", () => {
      render(<ProjectSetupView />);

      const nextButton = screen.getByRole("button", { name: /next: configure pipeline/i }) as HTMLButtonElement;
      expect(nextButton.disabled).toBe(true);
    });

    it("enables 'Next: Configure Pipeline' when name is typed", () => {
      render(<ProjectSetupView />);

      const input = screen.getByPlaceholderText("my-project");
      fireEvent.change(input, { target: { value: "cool-project" } });

      const nextButton = screen.getByRole("button", { name: /next: configure pipeline/i }) as HTMLButtonElement;
      expect(nextButton.disabled).toBe(false);
    });
  });

  // ── Scenario 2: Happy path step 1 -> step 2 ──

  describe("Step 1 to Step 2 navigation", () => {
    it("shows WorkflowBuilder and hides step 1 form after clicking Next", () => {
      render(<ProjectSetupView />);

      // Type a name
      const input = screen.getByPlaceholderText("my-project");
      fireEvent.change(input, { target: { value: "test-project" } });

      // Click next
      const nextButton = screen.getByRole("button", { name: /next: configure pipeline/i });
      fireEvent.click(nextButton);

      // Step 2: WorkflowBuilder stub visible
      expect(screen.getByTestId("workflow-builder")).toBeDefined();
      expect(screen.getByText("Builder")).toBeDefined();

      // Step 1 form is gone: the project name input should not be present
      expect(screen.queryByPlaceholderText("my-project")).toBeNull();

      // "Configure Pipeline" header visible
      expect(screen.getByText("Configure Pipeline")).toBeDefined();
    });
  });

  // ── Scenario 3: Back button ──

  describe("Back button", () => {
    it("returns to step 1 with name preserved after clicking Back", () => {
      render(<ProjectSetupView />);

      // Fill in name
      const input = screen.getByPlaceholderText("my-project");
      fireEvent.change(input, { target: { value: "my-awesome-app" } });

      // Navigate to step 2
      fireEvent.click(screen.getByRole("button", { name: /next: configure pipeline/i }));
      expect(screen.getByTestId("workflow-builder")).toBeDefined();

      // Click Back
      fireEvent.click(screen.getByRole("button", { name: /back/i }));

      // Step 1 reappears
      const restoredInput = screen.getByPlaceholderText("my-project") as HTMLInputElement;
      expect(restoredInput).toBeDefined();
      expect(restoredInput.value).toBe("my-awesome-app");

      // WorkflowBuilder is gone
      expect(screen.queryByTestId("workflow-builder")).toBeNull();
    });
  });

  // ── Scenario 4: Create project ──

  describe("Create project", () => {
    it("calls createProject after clicking 'Create Project' on step 2", async () => {
      // Pre-set activeWorkspace so the store's createWorkspace action succeeds.
      // We mock the Tauri commands that createWorkspace calls internally.
      mockCommands.createWorkspace.mockResolvedValue({
        name: "test-project", path: "/tmp/test-project",
        has_claude_md: false, repo_count: 0, skill_count: 0,
      });
      mockCommands.readFile.mockResolvedValue("");
      mockCommands.saveSetting.mockResolvedValue(undefined);
      mockCommands.watchWorkspaceClaudeMd.mockResolvedValue(undefined);
      mockCommands.readWorkspaceTree.mockResolvedValue([]);
      mockCommands.getAllRepos.mockResolvedValue([]);
      mockCommands.discoverSkills.mockResolvedValue([]);
      mockCommands.createProject.mockResolvedValue({
        id: "proj-42", name: "test-project", workspace_path: "/tmp/test-project",
        summary: "", created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z",
      });

      render(<ProjectSetupView />);

      // Step 1: type name
      const input = screen.getByPlaceholderText("my-project");
      fireEvent.change(input, { target: { value: "test-project" } });

      // Navigate to step 2
      fireEvent.click(screen.getByRole("button", { name: /next: configure pipeline/i }));
      expect(screen.getByTestId("workflow-builder")).toBeDefined();

      // Click Create Project
      fireEvent.click(screen.getByRole("button", { name: /create project/i }));

      // Wait for async flow to call createProject
      await waitFor(() => {
        expect(mockCommands.createWorkspace).toHaveBeenCalledWith("test-project");
      });

      await waitFor(() => {
        expect(mockCommands.createProject).toHaveBeenCalledWith("test-project", "/tmp/test-project");
      });

      // Verify the store was updated with the new project
      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.activeProjectId).toBe("proj-42");
        expect(state.currentView).toBe("conversation");
      });
    });

    it("shows 'Creating...' text while submitting", async () => {
      // Make createWorkspace hang so we can observe the submitting state
      let resolveWorkspace: (v: unknown) => void;
      mockCommands.createWorkspace.mockImplementation(
        () => new Promise((resolve) => { resolveWorkspace = resolve; }),
      );

      render(<ProjectSetupView />);

      // Go to step 2
      fireEvent.change(screen.getByPlaceholderText("my-project"), { target: { value: "loading-test" } });
      fireEvent.click(screen.getByRole("button", { name: /next: configure pipeline/i }));

      // Click create
      fireEvent.click(screen.getByRole("button", { name: /create project/i }));

      // Should show "Creating..." while the promise is pending
      await waitFor(() => {
        expect(screen.getByText("Creating...")).toBeDefined();
      });

      // Resolve to clean up
      resolveWorkspace!({
        name: "loading-test", path: "/tmp/loading-test",
        has_claude_md: false, repo_count: 0, skill_count: 0,
      });
    });
  });
});
