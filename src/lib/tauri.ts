import { invoke } from "@tauri-apps/api/core";

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

/**
 * Typed command wrappers for all Tauri IPC commands.
 * Each method maps to a #[tauri::command] in the Rust backend.
 */
export const commands = {
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
};
