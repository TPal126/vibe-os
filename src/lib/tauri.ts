import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

// ── Types matching Rust structs ──

export interface RepoMeta {
  id: string;
  name: string;
  org: string;
  branch: string;
  local_path: string;
  file_count: number;
  language: string;
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

/**
 * Typed command wrappers for all Tauri IPC commands.
 * Each method maps to a #[tauri::command] in the Rust backend.
 */
export const commands = {
  // ── Architecture ──
  analyzeArchitecture: (repoPaths: string[]) =>
    invoke<ArchGraph>("analyze_architecture", { repoPaths }),

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
  cloneRepo: (gitUrl: string) => invoke<RepoMeta>("clone_repo", { gitUrl }),
  getRepos: () => invoke<RepoMeta[]>("get_repos"),
  indexRepo: (repoPath: string) => invoke<string>("index_repo", { repoPath }),

  // ── Context commands ──
  discoverSkills: (activeRepoPaths: string[]) =>
    invoke<SkillMeta[]>("discover_skills", { activeRepoPaths }),
  composePrompt: (
    systemPrompt: string,
    taskContext: string,
    activeSkillPaths: string[],
    activeRepoSummaries: string[],
  ) =>
    invoke<ComposedPrompt>("compose_prompt", {
      systemPrompt,
      taskContext,
      activeSkillPaths,
      activeRepoSummaries,
    }),

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
  startClaude: (args: {
    working_dir: string;
    message: string;
    system_prompt?: string;
    conversation_id?: string;
  }) => invoke<string>("start_claude", { args }),

  sendMessage: (args: {
    message: string;
    conversation_id: string;
    working_dir: string;
  }) => invoke<string>("send_message", args),

  cancelClaude: (invocationId: string) =>
    invoke<void>("cancel_claude", { invocationId }),

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

  // ── Script commands ──
  getSessionScripts: (sessionId: string) =>
    invoke<ScriptEntryRaw[]>("get_session_scripts", { sessionId }),
  generateSkillFromScript: (scriptPath: string) =>
    invoke<SkillMeta>("generate_skill_from_script", { scriptPath }),
};

// ── Dialog helpers ──

export async function showSaveDialog(
  defaultName: string,
  filters: { name: string; extensions: string[] }[],
): Promise<string | null> {
  const path = await save({ defaultPath: defaultName, filters });
  return path;
}
