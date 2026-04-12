import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

// ── Types matching Rust structs ──

export interface RepoRow {
  id: string;
  name: string;
  source: string;
  path: string;
  git_url: string | null;
  branch: string;
  language: string;
  file_count: number;
  active: boolean;
  parent_id: string | null;
  created_at: string;
}

export interface SkillMeta {
  id: string;
  label: string;
  category: string;
  tokens: number;
  file_path: string;
  source: string;
}

export interface ComposedPrompt {
  system: string;
  task: string;
  skills: string;
  repo: string;
  full: string;
  total_tokens: number;
}

export interface SessionData {
  id: string;
  startedAt: string;
  systemPrompt: string;
  activeRepos: string;
  activeSkills: string;
}

export interface AuditEntry {
  id: string;
  session_id: string;
  timestamp: string;
  action_type: string;
  detail: string;
  actor: string;
  metadata: string | null;
}

// ── Architecture types ──

export interface ArchNode {
  id: string;
  label: string;
  node_type: string;
  repo_name: string;
  file_path: string;
  function_list: string[];
}

export interface ArchEdge {
  from_id: string;
  to_id: string;
  edge_type: string;
}

export interface ArchGraph {
  nodes: ArchNode[];
  edges: ArchEdge[];
}

// ── Claude session types ──

export interface ClaudeSessionInfo {
  id: string;
  name: string;
  created_at: string;
  status: string;
  conversation_id: string | null;
}

// ── Claude Code session discovery types ──

export interface ClaudeCodeSessionInfo {
  id: string;
  status: string;
  created_at: string;
  working_dir: string;
}

// ── Workspace types (matching Rust structs) ──

export interface WorkspaceMeta {
  name: string;
  path: string;
  has_claude_md: boolean;
  repo_count: number;
  skill_count: number;
}

export interface FileTreeEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileTreeEntry[] | null;
  extension: string | null;
}

export interface AgentDefinitionRaw {
  name: string;
  description: string;
  system_prompt: string;
  tools: string[];
  created_at: string;
  source_session_id: string;
  model: string | null;
  permission_mode: string | null;
  disallowed_tools: string[];
  max_turns: number | null;
  background: boolean;
  isolation: string | null;
  memory: string | null;
  skills: string[];
  color: string | null;
}

// ── CLI detection types ──

export interface CliInfo {
  name: string;
  version: string;
  path: string;
}

// ── Unified event type (snake_case from Rust) ──

export interface VibeEventRaw {
  id: string;
  session_id: string;
  timestamp: string;
  kind: string;
  action_type: string | null;
  detail: string | null;
  actor: string | null;
  metadata: string | null;
  rationale: string | null;
  confidence: number | null;
  impact_category: string | null;
  reversible: boolean | null;
  related_files: string | null;
  related_tickets: string | null;
}

// ── Raw types for new commands (snake_case from Rust) ──

export interface DecisionRaw {
  id: string;
  session_id: string;
  timestamp: string;
  decision: string;
  rationale: string;
  confidence: number;
  impact_category: string;
  reversible: boolean;
  related_files: string[];
  related_tickets: string[];
}

export interface AuditEntryRaw {
  id: string;
  session_id: string;
  timestamp: string;
  action_type: string;
  detail: string;
  actor: string;
  metadata: string | null;
}

export interface ScriptEntryRaw {
  path: string;
  name: string;
  first_seen: string;
  last_modified: string;
  modification_count: number;
}

export interface TokenBudgetRaw {
  id: string;
  scope_type: string;
  scope_id: string;
  max_tokens: number;
  warning_threshold: number;
  created_at: string;
  updated_at: string;
}

/**
 * Typed command wrappers for all Tauri IPC commands.
 * Each method maps to a #[tauri::command] in the Rust backend.
 */
export const commands = {
  // ── Architecture ──
  analyzeArchitecture: (repoPaths: string[]) =>
    invoke<ArchGraph>("analyze_architecture", { repoPaths }),

  graphGetTopology: () =>
    invoke<{
      repos: { id: string; label: string; node_type: string; framework: string; stats: string; active: boolean }[];
      modules: { id: string; label: string; node_type: string; framework: string; stats: string; active: boolean }[];
      edges: { source: string; target: string; edge_type: string }[];
    }>("graph_get_topology"),

  // ── Phase 1 test commands ──
  testDbWrite: () => invoke<string>("test_db_write"),
  testDbRead: () => invoke<string>("test_db_read"),
  testSpawn: () => invoke<string>("test_spawn"),

  // ── Session management ──
  createSession: () =>
    invoke<{ id: string; startedAt: string }>("create_session"),
  endSession: () => invoke<void>("end_session"),
  getActiveSession: () => invoke<SessionData | null>("get_active_session"),
  updateSessionRepos: (repoIds: string[]) =>
    invoke<void>("update_session_repos", { repoIds }),
  updateSessionSkills: (skillIds: string[]) =>
    invoke<void>("update_session_skills", { skillIds }),
  updateSessionPrompt: (systemPrompt: string) =>
    invoke<void>("update_session_prompt", { systemPrompt }),

  // ── Settings (used by Zustand persist storage adapter) ──
  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  saveSetting: (key: string, value: string) =>
    invoke<void>("save_setting", { key, value }),
  deleteSetting: (key: string) => invoke<void>("delete_setting", { key }),

  // ── Repo management ──
  saveRepo: (repo: RepoRow) =>
    invoke<RepoRow>("save_repo", { repo }),
  getAllRepos: () =>
    invoke<RepoRow[]>("get_all_repos"),
  deleteRepo: (id: string) =>
    invoke<void>("delete_repo", { id }),
  setRepoActive: (id: string, active: boolean) =>
    invoke<void>("set_repo_active", { id, active }),
  refreshRepoBranch: (id: string) =>
    invoke<string>("refresh_repo_branch", { id }),
  cloneRepo: (gitUrl: string) =>
    invoke<RepoRow>("clone_repo", { gitUrl, workspacePath: null }),
  indexRepo: (repoPath: string) => invoke<string>("index_repo", { repoPath }),
  listRemoteBranches: (repoId: string) =>
    invoke<string[]>("list_remote_branches", { repoId }),
  addBranchWorktree: (repoId: string, branch: string) =>
    invoke<RepoRow>("add_branch_worktree", { repoId, branch }),
  removeBranchWorktree: (repoId: string) =>
    invoke<void>("remove_branch_worktree", { repoId }),

  // ── Context commands ──
  discoverSkills: (activeRepoPaths: string[], workspacePath?: string) =>
    invoke<SkillMeta[]>("discover_skills", { activeRepoPaths, workspacePath: workspacePath ?? null }),
  composePrompt: (
    systemPrompt: string,
    taskContext: string,
    activeSkillPaths: string[],
    activeRepoSummaries: string[],
    skillBudgets?: [string, number][],
    repoBudgets?: [string, number][],
    sessionBudget?: number,
  ) =>
    invoke<ComposedPrompt>("compose_prompt", {
      systemPrompt,
      taskContext,
      activeSkillPaths,
      activeRepoSummaries,
      skillBudgets: skillBudgets ?? null,
      repoBudgets: repoBudgets ?? null,
      sessionBudget: sessionBudget ?? null,
    }),

  syncSkillsToClaude: (workspacePath?: string) =>
    invoke<string[]>("sync_skills_to_claude", { workspacePath: workspacePath ?? null }),

  // ── File I/O ──
  readFile: (path: string) => invoke<string>("read_file", { path }),
  writeFile: (path: string, content: string) =>
    invoke<void>("write_file", { path, content }),

  // ── Audit trail ──
  logAction: (
    actionType: string,
    detail: string,
    actor: string,
    metadata?: string,
  ) =>
    invoke<void>("log_action", { actionType, detail, actor, metadata }),
  getAuditLog: (limit?: number) =>
    invoke<AuditEntry[]>("get_audit_log", { limit }),

  // ── Claude Commands ──
  validateClaudeCli: () => invoke<string>("validate_claude_cli"),

  startClaude: (args: {
    working_dir: string;
    message: string;
    system_prompt?: string;
    conversation_id?: string;
    agent_session_id: string;
  }) => invoke<string>("start_claude", { args }),

  sendMessage: (args: {
    message: string;
    conversationId: string;
    workingDir: string;
    agentSessionId: string;
  }) => invoke<string>("send_message", args),

  cancelClaude: (agentSessionId: string) =>
    invoke<void>("cancel_claude", { agentSessionId }),

  listClaudeCodeSessions: () =>
    invoke<ClaudeCodeSessionInfo[]>("list_claude_code_sessions"),

  attachClaudeCodeSession: (sessionId: string, claudeSessionId: string) =>
    invoke<string>("attach_claude_code_session", { sessionId, claudeSessionId }),

  // ── Claude Session CRUD ──
  createClaudeSession: (sessionId: string, name: string) =>
    invoke<ClaudeSessionInfo>("create_claude_session", { sessionId, name }),

  listClaudeSessions: (sessionId: string) =>
    invoke<ClaudeSessionInfo[]>("list_claude_sessions", { sessionId }),

  closeClaudeSession: (claudeSessionId: string) =>
    invoke<void>("close_claude_session", { claudeSessionId }),

  getClaudeSession: (claudeSessionId: string) =>
    invoke<ClaudeSessionInfo>("get_claude_session", { claudeSessionId }),

  // ── Decision commands ──
  recordDecision: (
    sessionId: string,
    decision: string,
    rationale: string,
    confidence: number,
    impactCategory: string,
    reversible: boolean,
    relatedFiles: string[],
    relatedTickets: string[],
  ) =>
    invoke<DecisionRaw>("record_decision", {
      sessionId,
      decision,
      rationale,
      confidence,
      impactCategory,
      reversible,
      relatedFiles,
      relatedTickets,
    }),
  getSessionDecisions: (sessionId: string) =>
    invoke<DecisionRaw[]>("get_session_decisions", { sessionId }),
  exportDecisions: (sessionId: string, format: string, outputPath: string) =>
    invoke<void>("export_decisions", { sessionId, format, outputPath }),

  // ── Enhanced audit commands ──
  getSessionAudit: (sessionId: string, limit?: number) =>
    invoke<AuditEntryRaw[]>("get_session_audit", { sessionId, limit }),
  exportAuditLog: (sessionId: string, format: string, outputPath: string) =>
    invoke<void>("export_audit_log", { sessionId, format, outputPath }),

  // ── Unified event commands ──
  logEvent: (
    sessionId: string,
    kind: string,
    actionType?: string,
    detail?: string,
    actor?: string,
    metadata?: string,
    rationale?: string,
    confidence?: number,
    impactCategory?: string,
    reversible?: boolean,
    relatedFiles?: string,
    relatedTickets?: string,
  ) =>
    invoke<VibeEventRaw>("log_event", {
      sessionId,
      kind,
      actionType: actionType ?? null,
      detail: detail ?? null,
      actor: actor ?? null,
      metadata: metadata ?? null,
      rationale: rationale ?? null,
      confidence: confidence ?? null,
      impactCategory: impactCategory ?? null,
      reversible: reversible ?? null,
      relatedFiles: relatedFiles ?? null,
      relatedTickets: relatedTickets ?? null,
    }),
  getEvents: (sessionId: string, kind?: string, limit?: number) =>
    invoke<VibeEventRaw[]>("get_events", {
      sessionId,
      kind: kind ?? null,
      limit: limit ?? null,
    }),
  exportEvents: (sessionId: string, format: string, outputPath: string) =>
    invoke<void>("export_events", { sessionId, format, outputPath }),

  // ── Script commands ──
  getSessionScripts: (sessionId: string) =>
    invoke<ScriptEntryRaw[]>("get_session_scripts", { sessionId }),
  generateSkillFromScript: (scriptPath: string) =>
    invoke<SkillMeta>("generate_skill_from_script", { scriptPath }),

  // ── Workspace commands ──
  createWorkspace: (name: string) =>
    invoke<WorkspaceMeta>("create_workspace", { name }),
  openWorkspace: (workspacePath: string) =>
    invoke<WorkspaceMeta>("open_workspace", { workspacePath }),
  readWorkspaceTree: (workspacePath: string, maxDepth?: number) =>
    invoke<FileTreeEntry[]>("read_workspace_tree", { workspacePath, maxDepth: maxDepth ?? null }),
  watchWorkspaceClaudeMd: (workspacePath: string) =>
    invoke<void>("watch_workspace_claude_md", { workspacePath }),
  stopWorkspaceWatcher: () =>
    invoke<void>("stop_workspace_watcher"),

  // ── Token budget commands ──
  setTokenBudget: (
    scopeType: string,
    scopeId: string,
    maxTokens: number,
    warningThreshold?: number,
  ) =>
    invoke<TokenBudgetRaw>("set_token_budget", {
      scopeType,
      scopeId,
      maxTokens,
      warningThreshold: warningThreshold ?? null,
    }),
  getTokenBudgets: () =>
    invoke<TokenBudgetRaw[]>("get_token_budgets"),
  deleteTokenBudget: (id: string) =>
    invoke<void>("delete_token_budget", { id }),

  // ── CLI detection ──
  detectAvailableClis: () =>
    invoke<CliInfo[]>("detect_available_clis"),

  // ── Project commands ──
  createProject: (name: string, workspacePath: string) =>
    invoke<{ id: string; name: string; workspace_path: string; summary: string; created_at: string; updated_at: string }>("create_project", { name, workspacePath }),

  listProjects: () =>
    invoke<{ id: string; name: string; workspace_path: string; summary: string; created_at: string; updated_at: string }[]>("list_projects"),

  updateProject: (id: string, name?: string, summary?: string) =>
    invoke<void>("update_project", { id, name: name ?? null, summary: summary ?? null }),

  deleteProject: (id: string) =>
    invoke<void>("delete_project", { id }),

  // ── Pipeline commands ──
  createPipeline: (args: {
    project_id: string;
    name: string;
    phases: {
      label: string;
      phase_type: string;
      backend: string;
      framework: string;
      model: string;
      custom_prompt: string | null;
      gate_after: string;
    }[];
  }) => invoke<{ id: string; project_id: string; name: string; created_at: string; updated_at: string }>("create_pipeline", { args }),

  getProjectPipeline: (projectId: string) =>
    invoke<{ id: string; project_id: string; name: string; created_at: string; updated_at: string } | null>("get_project_pipeline", { projectId }),

  getPipelinePhases: (pipelineId: string) =>
    invoke<{ id: string; pipeline_id: string; position: number; label: string; phase_type: string; backend: string; framework: string; model: string; custom_prompt: string | null; gate_after: string }[]>("get_pipeline_phases", { pipelineId }),

  updatePipelinePhases: (pipelineId: string, phases: {
    label: string;
    phase_type: string;
    backend: string;
    framework: string;
    model: string;
    custom_prompt: string | null;
    gate_after: string;
  }[]) => invoke<void>("update_pipeline_phases", { pipelineId, phases }),

  deletePipeline: (pipelineId: string) =>
    invoke<void>("delete_pipeline", { pipelineId }),

  // ── Framework commands ──
  listFrameworks: () =>
    invoke<{
      id: string;
      name: string;
      supported_backends: string[];
      supported_phases: string[];
      features: { visual_companion: boolean; interactive_questions: boolean };
      phase_skills: Record<string, string>;
    }[]>("list_frameworks"),

  // ── Agent definition commands ──
  saveAgentDefinition: (
    name: string,
    description: string,
    systemPrompt: string,
    tools: string[],
    sourceSessionId: string,
    opts?: {
      model?: string | null;
      permissionMode?: string | null;
      disallowedTools?: string[];
      maxTurns?: number | null;
      background?: boolean;
      isolation?: string | null;
      memory?: string | null;
      skills?: string[];
      color?: string | null;
      workspacePath?: string | null;
    },
  ) =>
    invoke<AgentDefinitionRaw>("save_agent_definition", {
      name,
      description,
      systemPrompt,
      tools,
      sourceSessionId,
      model: opts?.model ?? null,
      permissionMode: opts?.permissionMode ?? null,
      disallowedTools: opts?.disallowedTools ?? null,
      maxTurns: opts?.maxTurns ?? null,
      background: opts?.background ?? null,
      isolation: opts?.isolation ?? null,
      memory: opts?.memory ?? null,
      skills: opts?.skills ?? null,
      color: opts?.color ?? null,
      workspacePath: opts?.workspacePath ?? null,
    }),
  loadAgentDefinitions: () =>
    invoke<AgentDefinitionRaw[]>("load_agent_definitions"),
  removeAgentDefinition: (name: string) =>
    invoke<void>("remove_agent_definition", { name }),
  getWorkspaceAgentDir: (workspacePath: string) =>
    invoke<string>("get_workspace_agent_dir", { workspacePath }),
};

// ── Dialog helpers ──

export async function showSaveDialog(
  defaultName: string,
  filters: { name: string; extensions: string[] }[],
): Promise<string | null> {
  const path = await save({ defaultPath: defaultName, filters });
  return path;
}

export async function showOpenWorkspaceDialog(): Promise<string | null> {
  const path = await open({
    directory: true,
    multiple: false,
    title: "Open Workspace",
  });
  return path as string | null;
}

export async function showOpenDirectoriesDialog(): Promise<string[] | null> {
  const paths = await open({
    directory: true,
    multiple: true,
    title: "Select Repositories",
  });
  if (!paths) return null;
  if (typeof paths === "string") return [paths];
  return paths;
}
