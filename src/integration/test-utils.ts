import { vi } from "vitest";
import { listen } from "@tauri-apps/api/event";

/**
 * Returns a full mock commands object covering every command in src/lib/tauri.ts.
 * All methods are vi.fn().mockResolvedValue(...) with sensible defaults.
 */
export function createMockCommands() {
  return {
    // ── Architecture ──
    analyzeArchitecture: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
    graphGetTopology: vi.fn().mockResolvedValue({ repos: [], modules: [], edges: [] }),

    // ── Phase 1 test commands ──
    testDbWrite: vi.fn().mockResolvedValue("ok"),
    testDbRead: vi.fn().mockResolvedValue("ok"),
    testSpawn: vi.fn().mockResolvedValue("ok"),

    // ── Session management ──
    createSession: vi.fn().mockResolvedValue({ id: "sess-1", startedAt: "2026-04-12T00:00:00Z" }),
    endSession: vi.fn().mockResolvedValue(undefined),
    getActiveSession: vi.fn().mockResolvedValue(null),
    updateSessionRepos: vi.fn().mockResolvedValue(undefined),
    updateSessionSkills: vi.fn().mockResolvedValue(undefined),
    updateSessionPrompt: vi.fn().mockResolvedValue(undefined),

    // ── Settings ──
    getSetting: vi.fn().mockResolvedValue(null),
    saveSetting: vi.fn().mockResolvedValue(undefined),
    deleteSetting: vi.fn().mockResolvedValue(undefined),

    // ── Repo management ──
    saveRepo: vi.fn().mockResolvedValue({
      id: "repo-1", name: "test-repo", source: "local", path: "/tmp/repo",
      git_url: null, branch: "main", language: "typescript", file_count: 0,
      active: true, parent_id: null, created_at: "2026-04-12T00:00:00Z",
    }),
    getAllRepos: vi.fn().mockResolvedValue([]),
    deleteRepo: vi.fn().mockResolvedValue(undefined),
    setRepoActive: vi.fn().mockResolvedValue(undefined),
    refreshRepoBranch: vi.fn().mockResolvedValue("main"),
    cloneRepo: vi.fn().mockResolvedValue({
      id: "repo-2", name: "cloned-repo", source: "git", path: "/tmp/cloned",
      git_url: "https://github.com/example/repo.git", branch: "main",
      language: "typescript", file_count: 0, active: true, parent_id: null,
      created_at: "2026-04-12T00:00:00Z",
    }),
    indexRepo: vi.fn().mockResolvedValue("indexed"),
    listRemoteBranches: vi.fn().mockResolvedValue([]),
    addBranchWorktree: vi.fn().mockResolvedValue({
      id: "repo-3", name: "worktree-repo", source: "local", path: "/tmp/worktree",
      git_url: null, branch: "feature", language: "typescript", file_count: 0,
      active: true, parent_id: "repo-1", created_at: "2026-04-12T00:00:00Z",
    }),
    removeBranchWorktree: vi.fn().mockResolvedValue(undefined),

    // ── Context commands ──
    discoverSkills: vi.fn().mockResolvedValue([]),
    composePrompt: vi.fn().mockResolvedValue({
      system: "", task: "", skills: "", repo: "", full: "", total_tokens: 0,
    }),
    syncSkillsToClaude: vi.fn().mockResolvedValue([]),

    // ── File I/O ──
    readFile: vi.fn().mockResolvedValue(""),
    writeFile: vi.fn().mockResolvedValue(undefined),

    // ── Audit trail ──
    logAction: vi.fn().mockResolvedValue(undefined),
    getAuditLog: vi.fn().mockResolvedValue([]),

    // ── Claude commands ──
    validateClaudeCli: vi.fn().mockResolvedValue("claude 1.0.0"),
    startClaude: vi.fn().mockResolvedValue("inv-1"),
    sendMessage: vi.fn().mockResolvedValue("inv-2"),
    cancelClaude: vi.fn().mockResolvedValue(undefined),
    listClaudeCodeSessions: vi.fn().mockResolvedValue([]),
    attachClaudeCodeSession: vi.fn().mockResolvedValue("inv-3"),

    // ── Claude session CRUD ──
    createClaudeSession: vi.fn().mockResolvedValue({
      id: "csess-1", name: "Default", created_at: "2026-04-12T00:00:00Z",
      status: "active", conversation_id: null,
    }),
    listClaudeSessions: vi.fn().mockResolvedValue([]),
    closeClaudeSession: vi.fn().mockResolvedValue(undefined),
    getClaudeSession: vi.fn().mockResolvedValue({
      id: "csess-1", name: "Default", created_at: "2026-04-12T00:00:00Z",
      status: "active", conversation_id: null,
    }),

    // ── Decision commands ──
    recordDecision: vi.fn().mockResolvedValue({
      id: "dec-1", session_id: "sess-1", timestamp: "2026-04-12T00:00:00Z",
      decision: "", rationale: "", confidence: 1.0, impact_category: "low",
      reversible: true, related_files: [], related_tickets: [],
    }),
    getSessionDecisions: vi.fn().mockResolvedValue([]),
    exportDecisions: vi.fn().mockResolvedValue(undefined),

    // ── Enhanced audit commands ──
    getSessionAudit: vi.fn().mockResolvedValue([]),
    exportAuditLog: vi.fn().mockResolvedValue(undefined),

    // ── Unified event commands ──
    logEvent: vi.fn().mockResolvedValue({
      id: "evt-1", session_id: "sess-1", timestamp: "2026-04-12T00:00:00Z",
      kind: "action", action_type: null, detail: null, actor: null,
      metadata: null, rationale: null, confidence: null, impact_category: null,
      reversible: null, related_files: null, related_tickets: null,
    }),
    getEvents: vi.fn().mockResolvedValue([]),
    exportEvents: vi.fn().mockResolvedValue(undefined),

    // ── Script commands ──
    getSessionScripts: vi.fn().mockResolvedValue([]),
    generateSkillFromScript: vi.fn().mockResolvedValue({
      id: "skill-1", label: "Generated Skill", category: "custom",
      tokens: 0, file_path: "/tmp/skill.md", source: "generated",
    }),

    // ── Workspace commands ──
    createWorkspace: vi.fn().mockResolvedValue({
      name: "test-workspace", path: "/tmp/workspace",
      has_claude_md: false, repo_count: 0, skill_count: 0,
    }),
    openWorkspace: vi.fn().mockResolvedValue({
      name: "test-workspace", path: "/tmp/workspace",
      has_claude_md: false, repo_count: 0, skill_count: 0,
    }),
    readWorkspaceTree: vi.fn().mockResolvedValue([]),
    watchWorkspaceClaudeMd: vi.fn().mockResolvedValue(undefined),
    stopWorkspaceWatcher: vi.fn().mockResolvedValue(undefined),

    // ── Token budget commands ──
    setTokenBudget: vi.fn().mockResolvedValue({
      id: "budget-1", scope_type: "session", scope_id: "sess-1",
      max_tokens: 100000, warning_threshold: 80000,
      created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z",
    }),
    getTokenBudgets: vi.fn().mockResolvedValue([]),
    deleteTokenBudget: vi.fn().mockResolvedValue(undefined),

    // ── CLI detection ──
    detectAvailableClis: vi.fn().mockResolvedValue([]),

    // ── Project commands ──
    createProject: vi.fn().mockResolvedValue({
      id: "proj-1", name: "test-project", workspace_path: "/tmp/test",
      summary: "", created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z",
    }),
    listProjects: vi.fn().mockResolvedValue([]),
    updateProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),

    // ── Pipeline commands ──
    createPipeline: vi.fn().mockResolvedValue({
      id: "pipeline-1", project_id: "proj-1", name: "Default",
      created_at: "2026-04-12T00:00:00Z", updated_at: "2026-04-12T00:00:00Z",
    }),
    getProjectPipeline: vi.fn().mockResolvedValue(null),
    getPipelinePhases: vi.fn().mockResolvedValue([]),
    updatePipelinePhases: vi.fn().mockResolvedValue(undefined),
    deletePipeline: vi.fn().mockResolvedValue(undefined),

    // ── Framework commands ──
    listFrameworks: vi.fn().mockResolvedValue([
      {
        id: "superpowers", name: "Superpowers",
        supported_backends: ["claude"],
        supported_phases: ["ideation", "planning", "execution", "verification", "review"],
        features: { visual_companion: true, interactive_questions: true },
        phase_skills: {},
      },
      {
        id: "native", name: "Native",
        supported_backends: ["claude", "codex"],
        supported_phases: ["ideation", "planning", "execution", "verification", "review", "custom"],
        features: { visual_companion: false, interactive_questions: false },
        phase_skills: {},
      },
    ]),

    // ── Agent definition commands ──
    saveAgentDefinition: vi.fn().mockResolvedValue({
      name: "test-agent", description: "", system_prompt: "", tools: [],
      created_at: "2026-04-12T00:00:00Z", source_session_id: "sess-1",
      model: null, permission_mode: null, disallowed_tools: [], max_turns: null,
      background: false, isolation: null, memory: null, skills: [], color: null,
    }),
    loadAgentDefinitions: vi.fn().mockResolvedValue([]),
    removeAgentDefinition: vi.fn().mockResolvedValue(undefined),
    getWorkspaceAgentDir: vi.fn().mockResolvedValue("/tmp/workspace/.agents"),

    // ── Workflow execution commands ──
    startPipeline: vi.fn().mockResolvedValue("run-1"),
    advanceGate: vi.fn().mockResolvedValue(undefined),
    getPipelineRunStatus: vi.fn().mockResolvedValue({
      pipeline_run_id: "run-1",
      status: "running",
      current_phase: {
        phase_run_id: "pr-1", phase_id: "p-1", label: "Ideation",
        status: "running", artifact_path: null, summary: null,
      },
      completed_phases: [],
    }),
  };
}

/**
 * Get the agent-stream listener callback from the mocked listen function.
 * Returns a function you can call with a payload to simulate events firing
 * through the real useAgentStream hook.
 *
 * Must be called after the component using useAgentStream has mounted.
 */
export function getAgentStreamFirer(): (payload: unknown) => void {
  const mockListen = listen as ReturnType<typeof vi.fn>;
  const call = mockListen.mock.calls.find((c: any[]) => c[0] === "agent-stream");
  if (!call) throw new Error("No agent-stream listener registered. Did useAgentStream mount?");
  const callback = call[1];
  return (payload: unknown) => callback({ payload });
}
