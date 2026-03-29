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

// -- Token Budget Types --

export interface TokenBudget {
  id: string;
  scopeType: "skill" | "repo" | "session";
  scopeId: string;
  maxTokens: number;
  warningThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface TokenSlice {
  tokenBudgets: TokenBudget[];
  tokenBudgetsLoading: boolean;
  loadTokenBudgets: () => Promise<void>;
  setTokenBudget: (
    scopeType: "skill" | "repo" | "session",
    scopeId: string,
    maxTokens: number,
    warningThreshold?: number,
  ) => Promise<void>;
  deleteTokenBudget: (id: string) => Promise<void>;
  getSkillBudget: (skillId: string) => TokenBudget | undefined;
  getRepoBudget: (repoId: string) => TokenBudget | undefined;
  getSessionBudget: () => TokenBudget | undefined;
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

export type CardType = "activity" | "outcome" | "error" | "decision";

export interface ActivityEvent {
  type: AgentEventType;
  content: string;
  tool?: string;
  path?: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  codeBlocks?: { language: string; code: string }[];
  cardType?: CardType;
  cardData?: Record<string, unknown>;
}

export interface ClaudeSessionState {
  id: string;
  name: string;
  chatMessages: ChatMessage[];
  agentEvents: AgentEvent[];
  isWorking: boolean;
  conversationId: string | null;
  currentInvocationId: string | null;
  agentError: string | null;
  needsInput: boolean;
  attentionPreview: string | null;
  attentionMessageId: string | null;
  status: "idle" | "working" | "needs-input" | "error";
  createdAt: string;
  currentActivityMessageId: string | null;
}

export interface AgentSlice {
  // CLI availability
  claudeCliAvailable: boolean | null;
  claudeCliError: string | null;
  validateClaudeCli: () => Promise<void>;

  // Per-session state
  claudeSessions: Map<string, ClaudeSessionState>;
  activeClaudeSessionId: string | null;

  // Session lifecycle
  createClaudeSessionLocal: (id: string, name: string) => void;
  removeClaudeSession: (id: string) => void;
  setActiveClaudeSessionId: (id: string | null) => void;
  renameClaudeSession: (id: string, name: string) => void;

  // Session-scoped mutations
  addSessionChatMessage: (sessionId: string, message: ChatMessage) => void;
  addSessionAgentEvent: (sessionId: string, event: AgentEvent) => void;
  appendToSessionLastAssistant: (sessionId: string, text: string) => void;
  setSessionWorking: (sessionId: string, working: boolean) => void;
  setSessionConversationId: (sessionId: string, id: string | null) => void;
  setSessionInvocationId: (sessionId: string, id: string | null) => void;
  setSessionError: (sessionId: string, error: string | null) => void;
  setSessionNeedsInput: (sessionId: string, needsInput: boolean) => void;
  clearSessionChat: (sessionId: string) => void;

  // Attention tracking
  setSessionAttention: (sessionId: string, preview: string | null, messageId: string | null) => void;
  clearSessionAttention: (sessionId: string) => void;

  // Rich card methods
  upsertActivityLine: (sessionId: string, event: AgentEvent) => void;
  finalizeActivityLine: (sessionId: string) => void;
  insertRichCard: (sessionId: string, cardType: CardType, content: string, cardData: Record<string, unknown>) => void;

  // Legacy compat (delegate to active session)
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

// ── Layout Types ──

export interface LayoutSlice {
  drawerOpen: boolean;
  activeDrawerTab: string;
  toggleDrawer: () => void;
  setDrawerOpen: (open: boolean) => void;
  setActiveDrawerTab: (tab: string) => void;
  openDrawerToTab: (tab: string) => void;
}

// ── Dashboard Types ──

export interface DashboardSlice {
  sessionGoal: string;
  setSessionGoal: (goal: string) => void;
}

// ── Project Types ──

export interface Project {
  id: string;
  name: string;
  workspacePath: string;
  claudeSessionId: string;
  summary: string;
  createdAt: string;
}

export type ViewMode = "home" | "conversation";

export interface ProjectSlice {
  projects: Project[];
  activeProjectId: string | null;
  currentView: ViewMode;

  // CRUD
  addProject: (name: string, workspacePath: string, claudeSessionId: string) => void;
  removeProject: (id: string) => void;
  updateProjectSummary: (id: string, summary: string) => void;

  // Navigation
  openProject: (id: string) => void;
  goHome: () => void;

  // Persistence
  loadProjects: () => Promise<void>;
  saveProjects: () => Promise<void>;
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
  WorkspaceSlice &
  LayoutSlice &
  DashboardSlice &
  TokenSlice &
  ProjectSlice;

// ── Slice Creator Helper ──

export type SliceCreator<T> = StateCreator<AppState, [], [], T>;
