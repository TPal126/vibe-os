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

// ── Mock Tauri commands ──

vi.mock("../lib/tauri", () => ({
  commands: mockCommands,
  showOpenWorkspaceDialog: vi.fn(),
}));

// ── Imports that depend on mocks ──

import { HomeScreen } from "../components/home/HomeScreen";
import { useAppStore } from "../stores";
import type { Project } from "../stores/types";

// ── Helpers ──

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-reopen-1",
    name: "Reopened Project",
    workspacePath: "/tmp/reopened",
    activeSessionId: "",
    summary: "A project loaded from SQLite",
    createdAt: "2026-04-10T00:00:00Z",
    linkedRepoIds: [],
    linkedSkillIds: [],
    linkedAgentNames: [],
    ...overrides,
  };
}

function resetStore() {
  useAppStore.setState({
    repos: [],
    activeWorkspace: null,
    workspaceLoading: false,
    workspaceTree: null,
    projects: [],
    activeProjectId: null,
    currentView: "home" as const,
    builderPhases: [],
    selectedPhaseId: null,
    frameworks: [],
    agentSessions: new Map(),
    activeSessionId: null,
    systemPrompt: "",
    skills: [],
  });
}

describe("HomeScreen project reopen integration", () => {
  beforeEach(() => {
    resetStore();
    Object.values(mockCommands).forEach((fn) => {
      if (typeof fn === "function" && "mockClear" in fn) {
        (fn as ReturnType<typeof vi.fn>).mockClear();
      }
    });
  });

  afterEach(cleanup);

  // ── Scenario 1: loadProjects hydrates from SQLite ──

  describe("loadProjects hydrates from SQLite", () => {
    it("loads projects with empty activeSessionId from SQLite rows", async () => {
      mockCommands.listProjects.mockResolvedValue([
        {
          id: "proj-sql-1",
          name: "SQL Project",
          workspace_path: "/tmp/sql-project",
          summary: "From database",
          created_at: "2026-04-10T00:00:00Z",
          updated_at: "2026-04-10T00:00:00Z",
        },
        {
          id: "proj-sql-2",
          name: "Another Project",
          workspace_path: "/tmp/another",
          summary: "",
          created_at: "2026-04-11T00:00:00Z",
          updated_at: "2026-04-11T00:00:00Z",
        },
      ]);

      await useAppStore.getState().loadProjects();

      const state = useAppStore.getState();
      expect(state.projects).toHaveLength(2);
      expect(state.projects[0].id).toBe("proj-sql-1");
      expect(state.projects[0].name).toBe("SQL Project");
      expect(state.projects[0].activeSessionId).toBe("");
      expect(state.projects[1].id).toBe("proj-sql-2");
      expect(state.projects[1].activeSessionId).toBe("");
    });

    it("renders loaded projects as cards in HomeScreen", async () => {
      // Seed projects directly into store (simulating post-loadProjects state)
      useAppStore.setState({
        projects: [makeProject({ id: "proj-vis-1", name: "Visible Project" })],
      });

      render(<HomeScreen />);

      expect(screen.getByText("Visible Project")).toBeDefined();
    });
  });

  // ── Scenario 2: Opening project creates fresh session ──

  describe("Opening project creates fresh session", () => {
    it("creates a new agentSession and updates activeSessionId when card is clicked", async () => {
      const project = makeProject();
      useAppStore.setState({ projects: [project] });

      render(<HomeScreen />);

      // The project name is rendered as a clickable button
      const projectButton = screen.getByText("Reopened Project");
      expect(projectButton).toBeDefined();

      // Verify no sessions exist before clicking
      expect(useAppStore.getState().agentSessions.size).toBe(0);
      expect(useAppStore.getState().activeSessionId).toBeNull();

      // Click the project name to open it
      fireEvent.click(projectButton);

      // Wait for async openWorkspace to resolve
      await waitFor(() => {
        const state = useAppStore.getState();

        // A fresh session should have been created
        expect(state.agentSessions.size).toBe(1);

        // activeSessionId should now be set
        expect(state.activeSessionId).not.toBeNull();
        expect(state.activeSessionId).not.toBe("");

        // The project's activeSessionId should have been updated
        const updatedProject = state.projects.find((p) => p.id === "proj-reopen-1");
        expect(updatedProject).toBeDefined();
        expect(updatedProject!.activeSessionId).toBe(state.activeSessionId);
      });

      // The new session should have the project name
      const state = useAppStore.getState();
      const session = state.agentSessions.get(state.activeSessionId!);
      expect(session).toBeDefined();
      expect(session!.name).toBe("Reopened Project");
    });

    it("reuses existing session if project has a valid activeSessionId", async () => {
      // Pre-create a session in the store
      const existingSessionId = "existing-sess-123";
      const sessions = new Map();
      sessions.set(existingSessionId, {
        id: existingSessionId,
        name: "Existing Session",
        backend: "claude" as const,
        chatMessages: [],
        agentEvents: [],
        isWorking: false,
        conversationId: null,
        currentInvocationId: null,
        agentError: null,
        needsInput: false,
        attentionPreview: null,
        attentionMessageId: null,
        status: "idle" as const,
        createdAt: "2026-04-10T00:00:00Z",
        currentActivityMessageId: null,
        previewUrl: null,
        testSummary: null,
        buildStatus: "idle" as const,
        buildStatusText: null,
        apiMetrics: null,
        tasks: [],
      });

      const project = makeProject({ activeSessionId: existingSessionId });
      useAppStore.setState({ projects: [project], agentSessions: sessions });

      render(<HomeScreen />);
      fireEvent.click(screen.getByText("Reopened Project"));

      await waitFor(() => {
        const state = useAppStore.getState();

        // Should NOT have created a new session — still just the one
        expect(state.agentSessions.size).toBe(1);

        // Should activate the existing session
        expect(state.activeSessionId).toBe(existingSessionId);
      });
    });

    it("creates a new session via 'New session' button at bottom of card", async () => {
      const project = makeProject();
      useAppStore.setState({ projects: [project] });

      render(<HomeScreen />);

      // The EnhancedProjectCard has a "New session" button
      const newSessionBtn = screen.getByText("New session");
      expect(newSessionBtn).toBeDefined();

      fireEvent.click(newSessionBtn);

      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.agentSessions.size).toBe(1);
        expect(state.activeSessionId).not.toBeNull();
      });
    });
  });

  // ── Scenario 3: Pipeline hydration on reopen ──

  describe("Pipeline hydration on reopen", () => {
    it("calls getProjectPipeline and loads phases into builderPhases", async () => {
      mockCommands.getProjectPipeline.mockResolvedValue({
        id: "pipeline-reopen",
        project_id: "proj-reopen-1",
        name: "Reopen Pipeline",
        created_at: "2026-04-10T00:00:00Z",
        updated_at: "2026-04-10T00:00:00Z",
      });

      mockCommands.getPipelinePhases.mockResolvedValue([
        {
          id: "phase-1",
          label: "Ideation",
          phase_type: "ideation",
          backend: "claude",
          framework: "native",
          model: "sonnet",
          custom_prompt: null,
          gate_after: "gated",
        },
        {
          id: "phase-2",
          label: "Execution",
          phase_type: "execution",
          backend: "claude",
          framework: "superpowers",
          model: "opus",
          custom_prompt: "Build it well",
          gate_after: "auto",
        },
      ]);

      const project = makeProject();
      useAppStore.setState({ projects: [project] });

      render(<HomeScreen />);
      fireEvent.click(screen.getByText("Reopened Project"));

      // Wait for pipeline hydration (called inside handleOpenProject)
      await waitFor(() => {
        expect(mockCommands.getProjectPipeline).toHaveBeenCalledWith("proj-reopen-1");
      });

      await waitFor(() => {
        expect(mockCommands.getPipelinePhases).toHaveBeenCalledWith("pipeline-reopen");
      });

      // Verify builder phases were hydrated
      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.builderPhases).toHaveLength(2);
        expect(state.builderPhases[0].label).toBe("Ideation");
        expect(state.builderPhases[0].phaseType).toBe("ideation");
        expect(state.builderPhases[1].label).toBe("Execution");
        expect(state.builderPhases[1].framework).toBe("superpowers");
        expect(state.builderPhases[1].customPrompt).toBe("Build it well");
        expect(state.builderPhases[1].gateAfter).toBe("auto");
      });
    });
  });

  // ── Scenario 4: Handles missing pipeline gracefully ──

  describe("Handles missing pipeline gracefully", () => {
    it("resets builderPhases to empty when no pipeline exists", async () => {
      // Pre-seed some builder phases to verify they get cleared
      useAppStore.setState({
        builderPhases: [
          {
            id: "stale-phase",
            label: "Stale",
            phaseType: "execution",
            backend: "claude" as const,
            framework: "native",
            model: "sonnet",
            customPrompt: null,
            gateAfter: "gated" as const,
          },
        ],
      });

      mockCommands.getProjectPipeline.mockResolvedValue(null);

      const project = makeProject();
      useAppStore.setState((state) => ({
        ...state,
        projects: [project],
      }));

      render(<HomeScreen />);
      fireEvent.click(screen.getByText("Reopened Project"));

      await waitFor(() => {
        expect(mockCommands.getProjectPipeline).toHaveBeenCalledWith("proj-reopen-1");
      });

      // builderPhases should be cleared (no pipeline found)
      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.builderPhases).toHaveLength(0);
      });
    });

    it("does not crash when getProjectPipeline rejects", async () => {
      mockCommands.getProjectPipeline.mockRejectedValue(new Error("DB connection lost"));

      const project = makeProject();
      useAppStore.setState({ projects: [project] });

      render(<HomeScreen />);

      // Should not throw
      fireEvent.click(screen.getByText("Reopened Project"));

      // The session should still be created even if pipeline load fails
      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.agentSessions.size).toBe(1);
        expect(state.activeSessionId).not.toBeNull();
      });
    });
  });

  // ── Scenario 5: openWorkspace is called with correct path ──

  describe("Workspace hydration", () => {
    it("calls openWorkspace with the project's workspacePath", async () => {
      const project = makeProject({ workspacePath: "/home/user/my-project" });
      useAppStore.setState({ projects: [project] });

      render(<HomeScreen />);
      fireEvent.click(screen.getByText("Reopened Project"));

      await waitFor(() => {
        expect(mockCommands.openWorkspace).toHaveBeenCalledWith("/home/user/my-project");
      });
    });

    it("still opens project when openWorkspace fails", async () => {
      mockCommands.openWorkspace.mockRejectedValue(new Error("Directory not found"));

      const project = makeProject();
      useAppStore.setState({ projects: [project] });

      render(<HomeScreen />);
      fireEvent.click(screen.getByText("Reopened Project"));

      // Session should be created and view changed even if workspace fails
      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.agentSessions.size).toBe(1);
        expect(state.currentView).toBe("conversation");
        expect(state.activeProjectId).toBe("proj-reopen-1");
      });
    });
  });
});
