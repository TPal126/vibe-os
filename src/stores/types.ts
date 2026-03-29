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
  source: "global" | "project" | "workspace";
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
  lastSaveTimestamp: number;
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  openUntitledFile: (content: string, language: string) => void;
}

export interface ConsoleEntry {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
  timestamp: number;
}

export interface ConsoleSlice {
  entries: ConsoleEntry[];
  inputHistory: string[];
  historyIndex: number;
  pythonRunning: boolean;
  addEntry: (entry: Omit<ConsoleEntry, 'id' | 'timestamp'>) => void;
  pushHistory: (cmd: string) => void;
  navigateHistory: (direction: 'up' | 'down') => string;
  setPythonRunning: (running: boolean) => void;
  clearEntries: () => void;
}

// ── Decision, Audit & Script Types ──

export interface Decision {
  id: string;
  sessionId: string;
  timestamp: string;
  decision: string;
  rationale: string;
  confidence: number;
  impactCategory: "perf" | "accuracy" | "dx" | "security" | "architecture";
  reversible: boolean;
  relatedFiles: string[];
  relatedTickets: string[];
}

export interface AuditEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  actionType: string;
  detail: string;
  actor: "agent" | "user" | "system";
  metadata: string | null;
}

export interface ScriptEntry {
  path: string;
  name: string;
  firstSeen: string;
  lastModified: string;
  modificationCount: number;
}

export interface DecisionSlice {
  decisions: Decision[];
  decisionsLoading: boolean;
  loadDecisions: () => Promise<void>;
  recordDecision: (
    decision: string,
    rationale: string,
    confidence: number,
    impactCategory: string,
    reversible: boolean,
    relatedFiles?: string[],
    relatedTickets?: string[],
  ) => Promise<void>;
  exportDecisions: (format: "json" | "csv") => Promise<void>;
}

export interface AuditSlice {
  auditEntries: AuditEntry[];
  auditLoading: boolean;
  loadAuditLog: () => Promise<void>;
  exportAuditLog: (format: "json" | "csv") => Promise<void>;
}

// ── Agent Types ──

export type AgentEventType =
  | "think"
  | "decision"
  | "file_create"
  | "file_modify"
  | "test_run"
  | "preview_update"
  | "error"
  | "result"
  | "raw";

export interface AgentEvent {
  timestamp: string;
  event_type: AgentEventType;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  codeBlocks?: { language: string; code: string }[];
}

export interface AgentSlice {
  chatMessages: ChatMessage[];
  agentEvents: AgentEvent[];
  isWorking: boolean;
  conversationId: string | null;
  currentInvocationId: string | null;
  agentError: string | null;
  addChatMessage: (message: ChatMessage) => void;
  addAgentEvent: (event: AgentEvent) => void;
  appendToLastAssistant: (text: string) => void;
  setWorking: (working: boolean) => void;
  setConversationId: (id: string | null) => void;
  setCurrentInvocationId: (id: string | null) => void;
  setAgentError: (error: string | null) => void;
  clearChat: () => void;
}

// ── Diff Types ──

export interface PendingDiff {
  id: string;
  filePath: string;
  originalContent: string;
  proposedContent: string;
  timestamp: string;
  status: "pending" | "accepted" | "rejected";
}

export interface DiffSlice {
  pendingDiffs: PendingDiff[];
  activeDiffId: string | null;
  addPendingDiff: (diff: Omit<PendingDiff, "id" | "status">) => void;
  acceptDiff: (id: string) => Promise<void>;
  rejectDiff: (id: string) => void;
  setActiveDiff: (id: string | null) => void;
}

// ── Preview Types ──

export interface PreviewSlice {
  previewUrl: string | null;
  autoRefresh: boolean;
  setPreviewUrl: (url: string) => void;
  toggleAutoRefresh: () => void;
}

// ── Workspace Types ──

export interface FileTreeEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileTreeEntry[] | null;
  extension: string | null;
}

export interface WorkspaceMeta {
  name: string;
  path: string;
  has_claude_md: boolean;
  repo_count: number;
  skill_count: number;
}

export interface WorkspaceSlice {
  activeWorkspace: { name: string; path: string } | null;
  workspaceTree: FileTreeEntry[] | null;
  workspaceLoading: boolean;
  createWorkspace: (name: string) => Promise<void>;
  openWorkspace: (path?: string) => Promise<void>;
  loadWorkspaceTree: () => Promise<void>;
  refreshWorkspaceTree: () => Promise<void>;
  closeWorkspace: () => Promise<void>;
}

// ── Combined State ──

export type AppState = SessionSlice &
  RepoSlice &
  SkillSlice &
  PromptSlice &
  EditorSlice &
  ConsoleSlice &
  AgentSlice &
  DecisionSlice &
  AuditSlice &
  DiffSlice &
  PreviewSlice &
  WorkspaceSlice;

// ── Slice Creator Helper ──

export type SliceCreator<T> = StateCreator<AppState, [], [], T>;
