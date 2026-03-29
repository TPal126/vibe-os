import type { StateCreator } from "zustand";
import type { SessionData } from "../lib/tauri";

// ── Domain Models ──

export interface Repo {
  id: string;
  name: string;
  org: string;
  branch: string;
  active: boolean;
  fileCount: number;
  language: string;
  localPath: string;
  indexSummary: string | null;
}

export interface Skill {
  id: string;
  label: string;
  category: "data" | "ml" | "core" | "web" | "infra" | "viz";
  active: boolean;
  tokens: number;
  filePath: string;
  source: "global" | "project";
}

// ── Slice Interfaces ──

export interface SessionSlice {
  activeSession: { id: string; startedAt: string } | null;
  createSession: () => Promise<void>;
  endSession: () => Promise<void>;
  loadActiveSession: () => Promise<SessionData | null>;
}

export interface RepoSlice {
  repos: Repo[];
  repoLoading: boolean;
  toggleRepo: (id: string) => Promise<void>;
  addRepo: (gitUrl: string) => Promise<void>;
  loadRepos: () => Promise<void>;
}

export interface SkillSlice {
  skills: Skill[];
  toggleSkill: (id: string) => Promise<void>;
  discoverSkills: () => Promise<void>;
}

export interface PromptSlice {
  systemPrompt: string;
  taskContext: string;
  composedPrompt: {
    system: string;
    task: string;
    skills: string;
    repo: string;
    full: string;
    totalTokens: number;
  } | null;
  setSystemPrompt: (text: string) => Promise<void>;
  setTaskContext: (text: string) => void;
  recompose: () => Promise<void>;
}

export interface EditorFile {
  path: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
}

export interface EditorSlice {
  openFiles: EditorFile[];
  activeFilePath: string | null;
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
}

// ── Combined State ──

export type AppState = SessionSlice &
  RepoSlice &
  SkillSlice &
  PromptSlice &
  EditorSlice;

// ── Slice Creator Helper ──

export type SliceCreator<T> = StateCreator<AppState, [], [], T>;
