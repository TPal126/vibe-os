import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSessionSlice } from "./slices/sessionSlice";
import { createRepoSlice } from "./slices/repoSlice";
import { createSkillSlice } from "./slices/skillSlice";
import { createPromptSlice } from "./slices/promptSlice";
import { createEditorSlice } from "./slices/editorSlice";
import { createConsoleSlice } from "./slices/consoleSlice";
import { createAgentSlice } from "./slices/agentSlice";
import { createDecisionSlice } from "./slices/decisionSlice";
import { createAuditSlice } from "./slices/auditSlice";
import { createDiffSlice } from "./slices/diffSlice";
import { createPreviewSlice } from "./slices/previewSlice";
import { createWorkspaceSlice } from "./slices/workspaceSlice";
import { createLayoutSlice } from "./slices/layoutSlice";
import { createDashboardSlice } from "./slices/dashboardSlice";
import { createTokenSlice } from "./slices/tokenSlice";
import { createProjectSlice } from "./slices/projectSlice";
import { tauriSqliteStorage } from "./storage";
import type { AppState } from "./types";

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createSessionSlice(...a),
      ...createRepoSlice(...a),
      ...createSkillSlice(...a),
      ...createPromptSlice(...a),
      ...createEditorSlice(...a),
      ...createConsoleSlice(...a),
      ...createAgentSlice(...a),
      ...createDecisionSlice(...a),
      ...createAuditSlice(...a),
      ...createDiffSlice(...a),
      ...createPreviewSlice(...a),
      ...createWorkspaceSlice(...a),
      ...createLayoutSlice(...a),
      ...createDashboardSlice(...a),
      ...createTokenSlice(...a),
      ...createProjectSlice(...a),
    }),
    {
      name: "vibe-os-store",
      storage: createJSONStorage(() => tauriSqliteStorage),
      // Only persist user-editable state, not computed values
      // Editor state NOT persisted -- files are on disk
      partialize: (state) => ({
        activeSession: state.activeSession,
        sessionGoal: state.sessionGoal,
      }),
    },
  ),
);

// Re-export types for convenience
export type {
  AppState,
  Repo,
  Skill,
  Decision,
  AuditEntry,
  ScriptEntry,
  FileTreeEntry,
  WorkspaceMeta,
  WorkspaceSlice,
  LayoutSlice,
  DashboardSlice,
  TokenBudget,
  Project,
  ProjectSlice,
  ViewMode,
} from "./types";
